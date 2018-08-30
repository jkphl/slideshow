'use strict';

const through = require('through2');
const Vinyl = require('vinyl');
const isUrl = require('is-url');

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
        || fileProperties.filter(p => !properties.has(p)).length
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
            ret = Object.keys(val).map(key => val[key]);
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
    return makeList(val).filter(v => isVinylFile(v));
}

/**
 * Convert a value into a list of regular expressions
 *
 * @param {String|Array|Object} val Value
 * @return {Array} Regex list
 */
function makeRegexList(val) {
    return makeList(val)
        .filter(v => ((typeof v === 'string' && v.trim().length) || (typeof v === 'object' && v.constructor === RegExp)))
        .map(v => (typeof v === 'string' ? new RegExp(v) : v));
}

/**
 * Convert a value into a list of URLs
 *
 * @param {String|Array|Object} val Value
 * @return {Array} URL list
 */
function makeUrlList(val) {
    return makeList(val).filter(v => isUrl(v));
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
     * @param {File|Array.<File>|Object.<String, File>} markdown Markdown slides
     * @param {File|Array.<File>|Object.<String, File>} css Custom CSS resources
     * @param {File|Array.<File>|Object.<String, File>} js Custom JavaScript resources
     */
    constructor(markdown, css, js) {
        this.markdownFiles = makeVinylFileList(markdown);
        this.jsFiles = makeVinylFileList(js);
        this.jsUrls = makeUrlList(js);
        this.cssFiles = makeVinylFileList(css);
        this.cssUrls = makeUrlList(css);
    }

    /**
     * Compile the slideshow
     *
     * @returns {String} Slideshow HTML
     */
    compile() {
        // If there are no slides: Return
        if (!this.markdownFiles.length) {
            return null;
        }


        return 'slideshow HTML';
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
        markdown: ['\\.md$'],
    }, config || {});
    options.css = makeRegexList(options.css);
    options.js = makeRegexList(options.js);

    // Prepare the resource lists
    const js = options.jsUrl;
    const css = options.cssUrl;
    const markdown = [];
    const other = [];

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

        other.push(file);
        cb();
    }

    /**
     * End the stream
     *
     * @param {Function} cb Callback
     */
    function endStream(cb) {
        const slides = (new Slideshow(markdown, css, js)).compile();
        if (slides !== null) {
            this.push(new Vinyl({
                contents: Buffer.from(slides),
            }));
        }

        other.forEach(file => this.push(file));

        cb();
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
