const gulp = require('gulp');
const Slideshow = require('.');

gulp.task('default', function () {
    return gulp.src(['./test/fixture/markdown/*.md', './test/fixture/scss/*.scss'])
    .pipe(Slideshow.stream())
    .pipe(gulp.dest('./tmp'));
});

gulp.task('watch', function () {
    gulp.watch([
        './test/fixture/markdown/**/*.md',
        './test/fixture/scss/**/*.scss',
        './test/fixture/js/**/*.js',
        './src/scss/**/*.scss',
        './src/js/**/*.js',
        './src/tmpl/**/*.hbs',
    ], ['default']);
});
