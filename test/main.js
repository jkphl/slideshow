/* global describe it */

const should = require('should');
const assert = require('stream-assert');
const gulp = require('gulp');
const path = require('path');
const Slideshow = require('..');

const markdownFiles = path.join(__dirname, 'fixture/markdown/*.md');
const scssFiles = path.join(__dirname, 'fixture/scss/*.scss');

/**
 * Scan a directory and return the contained files
 *
 * @param {String} dir Directory path
 * @returns {*} Filelist
 */
// function fileList(dir) {
//     return fs.readdirSync(dir).reduce((list, file) => {
//         const name = path.join(dir, file);
//         const isDir = fs.statSync(name).isDirectory();
//         return list.concat(isDir ? fileList(name) : [name]);
//     }, []);
// }

describe('Slideshow().stream', () => {
    it('should ignore null files', (done) => {
        const stream = Slideshow.stream();
        stream.pipe(assert.length(0))
            .pipe(assert.end(done));
        stream.end();
    });

    it('should error on streamed file', (done) => {
        gulp.src(markdownFiles, { buffer: false })
            .pipe(Slideshow.stream())
            .once('error', (err) => {
                err.message.should.eql('Slideshow: Streaming not supported');
                done();
            });
    });

    it('should pass through other resources', (done) => {
        gulp.src(path.join(__dirname, 'fixture/other/*'))
            .pipe(Slideshow.stream())
            .pipe(assert.length(2))
            .pipe(assert.nth(1, (d) => {
                should(path.basename(d.path)).eql('test.txt');
            }))
            .pipe(assert.end(done));
    });

    it('should create slideshow', (done) => {
        gulp.src([markdownFiles, scssFiles])
            .pipe(Slideshow.stream())
            .pipe(assert.length(1))
            .pipe(gulp.dest('./tmp'))
            .pipe(assert.end(done));
    });
});

// const slides = new Slideshow(fileList(markdownFiles));
//
// console.log(slides);
