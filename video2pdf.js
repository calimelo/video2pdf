//this program will use ffmpeg to convert a video file to a pdf file
//requires ffmpeg, imagemagick, pdftk, and powershell
const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const videoFileName = process.argv[2];
const imagecount = process.argv[3] || 10;

const programName = 'video2pdf';
const programVersion = '1.0.0';
const author = 'Dr. Kaan Gunduz';
console.clear();
console.log(`${programName} v${programVersion} by ${author}`);
console.log('This program will convert a video file to a pdf file');
console.log('Requires ffmpeg, and ffprobe to be installed');
console.log('Usage: video2pdf.exe <video file name> <frame count>');
console.log('Example: video2pdf.exe myvideo.mp4 10');
console.log('_'.repeat(80));

if (!videoFileName) {
  console.log('Please provide a video file name');
  process.exit();
}
if (!imagecount) {
  console.log('No frame count provided, using default value 10');
}

//convert the video file to a pdf file
const videoFilePath = path.join(__dirname, videoFileName);
const pdfFilePath = path.join(__dirname, videoFileName + '.pdf');
const tempPath = path.join(__dirname, 'tempframes');
if (!fs.existsSync(tempPath)) {
  fs.mkdirSync(tempPath);
}

//export the video file to a series of png files thumbnail images
//we need a fixed number of images which is imagecount
//so we need to calculate the frame rate to get the images

//get the duration of the video file
const command1 =
  'ffprobe -i ' +
  videoFilePath +
  ' -show_entries format=duration -v quiet -of csv="p=0"';
const duration = execSync(command1).toString();
//calculate the frame rate
const frameCount = Math.floor(duration / imagecount);
//export the video file to a series of png files and hide ffmpeg output
const command2 =
  'ffmpeg -i ' +
  videoFilePath +
  ' -vf fps=1/' +
  frameCount +
  ' ' +
  tempPath +
  '/%d.png' +
  ' -loglevel quiet -nostats -hide_banner';

// const command2 =
//   'ffmpeg -i ' +
//   videoFilePath +
//   ' -vf fps=1/' +
//   frameCount +
//   ' ' +
//   tempPath +
//   '/%d.png';
try {
  execSync(command2, (err, stdout, stderr) => {
    if (err) {
      console.error(err);
      return;
    }
  });
} catch (error) {
  console.log(error);
}

//resize the thumbnail images to 200 height and 300 width using jimp
const jimp = require('jimp');
const images = fs.readdirSync(tempPath);
images.forEach((image) => {
  const imagePath = path.join(tempPath, image);

  jimp
    .read(imagePath)
    .then((image) => {
      image.resize(200, 150);
      image.write(imagePath);
    })
    .catch((err) => {
      console.log(err);
    });
});
//server the thumbnail images
app.use(express.static(tempPath));
app.listen(3000, () => {
  //   console.log('Temp server started');
});

//use served paths to create a pdf file
const imagePaths = images.map((image) => {
  return 'http://localhost:3000/' + image;
});
let videofilename = videoFilePath.split('\\').pop();

const ejs = require('ejs');
const ejscontent = `<html>
<body>
    <h1>${videofilename}</h1>
  <ul>
    <% images.forEach(image => { %>
    <img src="<%- image%>" />
    <% }) %>
  </ul>
</body>
</html>`;
fs.writeFileSync(path.join(__dirname, 'template.ejs'), ejscontent);

const htmlPdf = require('html-pdf');
const html = ejs.render(
  fs.readFileSync(path.join(__dirname, 'template.ejs'), 'utf8'),
  { images: imagePaths },
);

htmlPdf.create(html).toFile(pdfFilePath, (err, res) => {
  if (err) return console.log(err);
  console.log(res.filename);

  fs.unlinkSync(path.join(__dirname, 'template.ejs'));
  //delete the temp folder contents but not the folder
  const files = fs.readdirSync(tempPath);
  files.forEach((file) => {
    fs.unlinkSync(path.join(tempPath, file));
  });

  //exit the server after the pdf file is created
  process.exit();
});
