const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const download = require('download');
const sh = require('shorthash');

let config = { verbose: false };

const processImage = async img => {
  let { distPath, assetPath } = config;

  const external = /https?:\/\/((?:[\w\d-]+\.)+[\w\d]{2,})/i;
  const imgPath = img.getAttribute('src');

  try {
    if (external.test(imgPath)) {

      // get the filname from the path
      const pathComponents = imgPath.split('/');
      const filename = pathComponents[pathComponents.length - 1];
      
      // generate a unique short hash based on the original file path
      // this will prevent filename clashes
      const hash = sh.unique(imgPath);

      // create the file path from config
      const outputFilePath = path.join(distPath,assetPath,`${hash}-${filename}`);

      // image is external so download it.
      const imgBuffer = await download(imgPath);

      // save the file out, and log it to the console
      fs.writeFile(
        outputFilePath, 
        imgBuffer, 
        (err) => {
          if (err) { throw err; }
          if (config.verbose) {
            console.log(`eleventy-plugin-local-images: Saved ${filename} to ${outputFilePath}`);
          }
        }
      );

      // Update the image with the new file path
      img.setAttribute('src', path.join(assetPath, `${hash}-${filename}`));  
    }

    return img;

  } catch (err) {
    // log the error but carry on. If a filepath gets missed, it isn't the end of the world.
    if (err.url) {
      console.log(`eleventy-plugin-local-images: Couldn\'t reach image ${err.url}`);
    } else {
      console.log(err);
    }
  }
};

const grabRemoteImages = async (rawContent, outputPath) => {
  let { selector = 'img' } = config;
  let content = rawContent;

  if (outputPath.endsWith('.html')) {
    const dom = new JSDOM(content);
    const images = [...dom.window.document.querySelectorAll(selector)];

    if (images.length > 0) {
      await Promise.all(images.map(i => processImage(i)));
      content = dom.serialize();
    }
  }

  return content;
};

module.exports = {
  initArguments: {},
  configFunction: async (eleventyConfig, pluginOptions = {}) => {
    config = Object.assign({}, config, pluginOptions);

    // check the required config is present
    if (!config.assetPath || !config.distPath) {
      throw new Error("eleventy-plugin-local-images requires that assetPath and distPath are set");
    }

    eleventyConfig.addTransform('localimages', grabRemoteImages);
  },
};