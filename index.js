const through = require('through2');
const Vinyl = require('vinyl');
const vinylFile = require('vinyl-file');
const isUrl = require('is-url');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const marked = require('marked');
const sass = require('node-sass');
const UglifyJS = require('uglify-js');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');

const fileProperties = ['history', 'stat', '_contents'];

/**
 * Test if an object is a vinyl file
 *
 * @param {File|Object} file Vinyl file / object
 * @return {Boolean} Object is a Vinyl file
 */
function isVinylFile(file) {
    if (Vinyl.isVinyl(file)) {
        return true;
    }
    if (!file || (typeof file !== 'object')) {
        return false;
    }
    const properties = new Set(Object.getOwnPropertyNames(file));
    if ((!properties.has('cwd') && !properties.has('_cwd'))
        || fileProperties.filter((p) => !properties.has(p)).length
    ) {
        return false;
    }
    const content = Object.getOwnPropertyDescriptor(file, '_contents');
    return (typeof content === 'object') && content.writable && content.enumerable && content.configurable;
}

/**
 * Convert a value into a value list
 *
 * @param {String|Array|Object} val Value
 * @return {Array} Value list
 */
function makeList(val) {
    if (val === null) {
        return [];
    }
    let ret = val;

    if (!Array.isArray(val)) {
        if ((typeof val === 'object') && (val.constructor === Object)) {
            ret = Object.keys(val).map((key) => val[key]);
        } else {
            ret = [val];
        }
    }

    return ret;
}

/**
 * Convert a value into a list of Vinyl files
 *
 * @param {String|Array|Object} val Value
 * @return {Array} Value list
 */
function makeVinylFileList(val) {
    return makeList(val).filter((v) => isVinylFile(v));
}

/**
 * Convert a value into a list of regular expressions
 *
 * @param {String|Array|Object} val Value
 * @return {Array} Regex list
 */
function makeRegexList(val) {
    return makeList(val)
        .filter((v) => {
            const isString = typeof v === 'string' && v.trim().length;
            const isRegex = typeof v === 'object' && v.constructor === RegExp;
            return isString || isRegex;
        })
        .map((v) => (typeof v === 'string' ? new RegExp(v) : v));
}

/**
 * Convert a value into a list of URLs
 *
 * @param {String|Array|Object} val Value
 * @return {Array} URL list
 */
function makeUrlList(val) {
    return makeList(val).filter((v) => isUrl(v));
}

/**
 *
 *
 * @returns {number} Sort order
 */
/**
 * Sort Vinyl resources by file name
 *
 * @param {Vinyl} a Vinyl file
 * @param {Vinyl} b Vinyl file
 * @returns {number} Sort order
 */
function sortVinylResources(a, b) {
    const an = path.basename(a.path);
    const bn = path.basename(b.path);
    if (an === bn) {
        return 0;
    }
    return (an > bn) ? 1 : -1;
}

/**
 * Slideshow class
 */
class Slideshow {
    /**
     * Slideshow constructor
     *
     * @param {Object} config
     */
    /**
     * Slideshow constructor
     *
     * @param {Object} config Main configuration
     * @param {File|Array.<File>|Object.<String, File>} markdown Markdown slides
     * @param {File|Array.<File>|Object.<String, File>} css Custom CSS resources
     * @param {File|Array.<File>|Object.<String, File>} js Custom JavaScript resources
     * @param {File|Array.<File>|Object.<String, File>} intro Custom intro resources
     * @param {File|Array.<File>|Object.<String, File>} outro Custom outro resources
     */
    constructor(config, markdown, css, js, intro, outro) {
        this.config = {
            title: config.title || 'Slideshow title',
            author: config.author || 'Author',
            description: config.description || 'Slideshow description',
            language: config.language || 'en',
            charset: config.charset || 'UTF-8'
        };
        this.markdownFiles = makeVinylFileList(markdown);
        this.jsFiles = makeVinylFileList(js);
        this.jsUrls = makeUrlList(js);
        this.cssFiles = makeVinylFileList(css);
        this.cssUrls = makeUrlList(css);
        this.introFiles = makeVinylFileList(intro);
        this.outroFiles = makeVinylFileList(outro);
    }

    /**
     * Compile the slideshow
     */
    compile(cb) {
        // If there are no slides: Return
        if (!this.markdownFiles.length) {
            cb();
            return;
        }

        const markdown = this.markdownFiles;
        const data = Object.assign({}, this.config);
        data.slides = [];

        // Read the main template
        fs.readFile(path.join(__dirname, 'src/tmpl/slideshow.hbs'), 'utf-8', (error1, source) => {
            if (error1) {
                cb(error1);
                return;
            }

            // Prepare JavaScript resources
            this.jsFiles.push(vinylFile.readSync(path.join(__dirname, 'src/js/100-slideshow.js')));
            const js = this.jsFiles.sort(sortVinylResources).reduce((a, c) => `${a};${c.contents.toString()}`, '');
            data.js = UglifyJS.minify(js, { compress: false, mangle: false }).code;
            data.intro = this.introFiles.sort(sortVinylResources).reduce((a, c) => `${a}${c.contents.toString()}`, '');
            data.outro = this.outroFiles.sort(sortVinylResources).reduce((a, c) => `${a}${c.contents.toString()}`, '');

            // Prepare SCSS resources
            this.cssFiles.push(vinylFile.readSync(path.join(__dirname, 'src/scss/100-slideshow.scss')));
            sass.render(
                {
                    data: this.cssFiles.sort(sortVinylResources)
                        .reduce((a, c) => `${a}${c.contents.toString()}`, ''),
                    includePaths: [path.join(__dirname, 'src/scss')],
                    outputStyle: 'compressed'
                },
                (error2, result1) => {
                    if (error2) {
                        cb(error2);
                        return;
                    }
                    postcss([autoprefixer]).process(result1.css, { from: 'undefined' }).then((result2) => {
                        result2.warnings().forEach((warn) => {
                            console.warn(warn.toString());
                        });
                        data.css = result2.css;

                        // Prepare the slides
                        markdown.forEach((file, index) => {
                            const slide = matter(file.contents);
                            slide.data.id = slide.data.id || `slide-${index}`;
                            slide.data.title = slide.data.title || slide.data.id;
                            slide.data.isQuote = slide.data.type && (slide.data.type === 'quote');
                            slide.data.quote = Object.assign({
                                author: '',
                                url: '',
                                image: ''
                            }, slide.data.quote);
                            slide.data.align = slide.data.align || 'left';
                            slide.data.valign = slide.data.valign || 'top';
                            slide.data.gradient = ('gradient' in slide.data) ? !!slide.data.gradient : true;
                            slide.data.css = slide.data.css || '';
                            slide.data.steps = parseInt(slide.data.steps || '0', 10);
                            slide.data.theme = slide.data.theme || '';
                            slide.data.leave = slide.data.leave || '';
                            slide.data.enter = slide.data.enter || '';
                            const parts = slide.content.split('---\n');
                            slide.content = marked.parse(parts.shift());
                            if (parts.length) {
                                slide.footer = marked.parse(parts.shift());
                            }
                            data.slides.push(slide);
                        });

                        // Templating
                        const template = handlebars.compile(source);
                        const html = template(data);
                        cb(null, html);
                    });
                }
            );
        });
    }
}

/**
 * Streaming interface for Slideshow
 *
 * @param {Object} config Configuration
 */
Slideshow.stream = function stream(config) {
    const options = Object.assign({
        css: ['\\.scss$'],
        cssUrl: [],
        js: ['\\.js$'],
        jsUrl: [],
        markdown: ['\\.md$']
    }, config);
    options.css = makeRegexList(options.css);
    options.js = makeRegexList(options.js);

    // Prepare the resource lists
    const js = options.jsUrl;
    const css = options.cssUrl;
    const markdown = [];
    const other = [];
    const intro = [];
    const outro = [];

    /**
     * Buffer incoming contents
     *
     * @param {File} file File
     * @param enc
     * @param {Function} cb Callback
     */
    function bufferContents(file, enc, cb) {
        // We don't do streams
        if (file.isStream()) {
            this.emit('error', new Error('Slideshow: Streaming not supported'));
            cb();
            return;
        }

        // Detect whether it's a JavaScript resource
        for (const r of options.js) {
            if (file.relative.match(r)) {
                js.push(file);
                cb();
                return;
            }
        }

        // Detect whether it's a CSS resource
        for (const r of options.css) {
            if (file.relative.match(r)) {
                css.push(file);
                cb();
                return;
            }
        }

        // Detect whether it's a Markdown resource
        for (const r of options.markdown) {
            if (file.relative.match(r)) {
                markdown.push(file);
                cb();
                return;
            }
        }

        // Detect intro files
        if (file.relative.match('\\.intro\\.[a-zA-Z0-9]+$')) {
            intro.push(file);
            cb();
            return;
        }

        // Detect outro files
        if (file.relative.match('\\.outro\\.[a-zA-Z0-9]+$')) {
            outro.push(file);
            cb();
            return;
        }

        other.push(file);
        cb();
    }

    /**
     * End the stream
     *
     * @param {Function} cb Callback
     */
    function endStream(cb) {
        other.forEach((file) => this.push(file));

        (new Slideshow(options, markdown, css, js, intro, outro)).compile((error, slides) => {
            if (error || !slides) {
                cb(error);
                return;
            }

            // console.log(slides);

            this.push(new Vinyl({
                contents: Buffer.from(slides),
                path: 'slideshow.html'
            }));

            cb();
        });
    }

    return through.obj(bufferContents, endStream);
};

/**
 * Module export (Slideshow class)
 *
 * @param {File|Array.<File>|Object.<String, File>} markdown Markdown slides
 * @param {File|Array.<File>|Object.<String, File>} css Custom CSS resources
 * @param {File|Array.<File>|Object.<String, File>} js Custom JavaScript resources
 * @return {Slideshow} Slideshow class
 */
module.exports = Slideshow;
