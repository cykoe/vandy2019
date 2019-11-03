import * as posenet from '@tensorflow-models/posenet';
import similarity from 'compute-cosine-similarity';

import {
  drawBoundingBox,
  drawKeypoints,
  drawSkeleton,
  isMobile,
  toggleLoadingUI,
  tryResNetButtonName,
  updateTryResNetButtonDatGuiCss,
} from './demo_util';

const videoWidth = 600;
const videoHeight = 800;
let changed = false;

/**
 * Loads a the camera to be used in the demo
 *
 */
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
        'Browser API navigator.mediaDevices.getUserMedia not available');
  }

  const video = document.getElementById('video');
  video.width = videoWidth;
  video.height = videoHeight;

  const mobile = isMobile();
  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      width: mobile ? undefined:videoWidth,
      height: mobile ? undefined:videoHeight,
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function loadVideo() {
  const video = await setupCamera();
  video.play();

  return video;
}

const defaultQuantBytes = 2;

const defaultMobileNetMultiplier = isMobile() ? 0.50:0.75;
const defaultMobileNetStride = 16;
const defaultMobileNetInputResolution = 500;

const defaultResNetMultiplier = 1.0;
const defaultResNetStride = 32;
const defaultResNetInputResolution = 250;

const guiState = {
  algorithm: 'single-pose',
  input: {
    architecture: 'MobileNetV1',
    outputStride: defaultMobileNetStride,
    inputResolution: defaultMobileNetInputResolution,
    multiplier: defaultMobileNetMultiplier,
    quantBytes: defaultQuantBytes,
  },
  singlePoseDetection: {
    minPoseConfidence: 0.1,
    minPartConfidence: 0.5,
  },
  multiPoseDetection: {
    maxPoseDetections: 5,
    minPoseConfidence: 0.15,
    minPartConfidence: 0.1,
    nmsRadius: 30.0,
  },
  output: {
    showVideo: true,
    showSkeleton: false,
    showPoints: false,
    showBoundingBox: false,
  },
  net: null,
};

function wait(ms)
{
  var d = new Date();
  var d2 = null;
  do { d2 = new Date(); }
  while(d2-d < ms);
}


/**
 * Sets up dat.gui controller on the top-right of the window
 */
function setupGui(cameras, net) {
  guiState.net = net;

  if (cameras.length > 0) {
    guiState.camera = cameras[0].deviceId;
  }

  let architectureController = null;
  guiState[tryResNetButtonName] = function() {
    architectureController.setValue('ResNet50');
  };
  updateTryResNetButtonDatGuiCss();

  // The single-pose algorithm is faster and simpler but requires only one
  // person to be in the frame or results will be innaccurate. Multi-pose works
  // for more than 1 person
  // const algorithmController =
  // gui.add(guiState, 'algorithm', ['multi-pose', 'single-pose']);

  // The input parameters have the most effect on accuracy and speed of the
  // network
  // let input = gui.addFolder('Input');
  // Architecture: there are a few PoseNet models varying in size and
  // accuracy. 1.01 is the largest, but will be the slowest. 0.50 is the
  // fastest, but least accurate.
  // architectureController =
  //     input.add(guiState.input, 'architecture', ['MobileNetV1', 'ResNet50']);
  guiState.architecture = guiState.input.architecture;
  // Input resolution:  Internally, this parameter affects the height and width
  // of the layers in the neural network. The higher the value of the input
  // resolution the better the accuracy but slower the speed.
  let inputResolutionController = null;

  function updateGuiInputResolution(
      inputResolution,
      inputResolutionArray,
  ) {
    if (inputResolutionController) {
      inputResolutionController.remove();
    }
    guiState.inputResolution = inputResolution;
    guiState.input.inputResolution = inputResolution;
    // inputResolutionController =
    //     input.add(guiState.input, 'inputResolution', inputResolutionArray);
    // inputResolutionController.onChange(function(inputResolution) {
    //   guiState.changeToInputResolution = inputResolution;
    // });
  }

  // Output stride:  Internally, this parameter affects the height and width of
  // the layers in the neural network. The lower the value of the output stride
  // the higher the accuracy but slower the speed, the higher the value the
  // faster the speed but lower the accuracy.
  let outputStrideController = null;

  function updateGuiOutputStride(outputStride, outputStrideArray) {
    if (outputStrideController) {
      outputStrideController.remove();
    }
    guiState.outputStride = outputStride;
    guiState.input.outputStride = outputStride;
    // outputStrideController =
    //     input.add(guiState.input, 'outputStride', outputStrideArray);
    // outputStrideController.onChange(function(outputStride) {
    //   guiState.changeToOutputStride = outputStride;
    // });
  }

  // Multiplier: this parameter affects the number of feature map channels in
  // the MobileNet. The higher the value, the higher the accuracy but slower the
  // speed, the lower the value the faster the speed but lower the accuracy.
  let multiplierController = null;

  function updateGuiMultiplier(multiplier, multiplierArray) {
    if (multiplierController) {
      multiplierController.remove();
    }
    guiState.multiplier = multiplier;
    guiState.input.multiplier = multiplier;
    // multiplierController =
    //     input.add(guiState.input, 'multiplier', multiplierArray);
    // multiplierController.onChange(function(multiplier) {
    //   guiState.changeToMultiplier = multiplier;
    // });
  }

  // QuantBytes: this parameter affects weight quantization in the ResNet50
  // model. The available options are 1 byte, 2 bytes, and 4 bytes. The higher
  // the value, the larger the model size and thus the longer the loading time,
  // the lower the value, the shorter the loading time but lower the accuracy.
  let quantBytesController = null;

  function updateGuiQuantBytes(quantBytes, quantBytesArray) {
    if (quantBytesController) {
      quantBytesController.remove();
    }
    guiState.quantBytes = +quantBytes;
    guiState.input.quantBytes = +quantBytes;
    // quantBytesController =
    //     input.add(guiState.input, 'quantBytes', quantBytesArray);
    // quantBytesController.onChange(function(quantBytes) {
    //   guiState.changeToQuantBytes = +quantBytes;
    // });
  }

  function updateGui() {
    if (guiState.input.architecture === 'MobileNetV1') {
      updateGuiInputResolution(
          defaultMobileNetInputResolution,
          [200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800]);
      updateGuiOutputStride(defaultMobileNetStride, [8, 16]);
      updateGuiMultiplier(defaultMobileNetMultiplier, [0.50, 0.75, 1.0]);
    } else { // guiState.input.architecture === "ResNet50"
      updateGuiInputResolution(
          defaultResNetInputResolution,
          [200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800]);
      updateGuiOutputStride(defaultResNetStride, [32, 16]);
      updateGuiMultiplier(defaultResNetMultiplier, [1.0]);
    }
    updateGuiQuantBytes(defaultQuantBytes, [1, 2, 4]);
  }

  updateGui();
}

/**
 * Feeds an image to posenet to estimate poses - this is where the magic
 * happens. This function loops with a requestAnimationFrame method.
 */
function detectPoseInRealTime(video, net) {
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const canvas = document.getElementById('output');
  const ctx = canvas.getContext('2d');

  // since images are being fed from a webcam, we want to feed in the
  // original image and then just flip the keypoints' x coordinates. If instead
  // we flip the image, then correcting left-right keypoint pairs requires a
  // permutation on all the keypoints.
  const flipPoseHorizontal = true;

  canvas.width = videoWidth;
  canvas.height = videoHeight;

  async function poseDetectionFrame() {
    if (guiState.changeToArchitecture) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.changeToArchitecture,
        outputStride: guiState.outputStride,
        inputResolution: guiState.inputResolution,
        multiplier: guiState.multiplier,
      });
      toggleLoadingUI(false);
      guiState.architecture = guiState.changeToArchitecture;
      guiState.changeToArchitecture = null;
    }

    if (guiState.changeToMultiplier) {
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.architecture,
        outputStride: guiState.outputStride,
        inputResolution: guiState.inputResolution,
        multiplier: +guiState.changeToMultiplier,
        quantBytes: guiState.quantBytes,
      });
      toggleLoadingUI(false);
      guiState.multiplier = +guiState.changeToMultiplier;
      guiState.changeToMultiplier = null;
    }

    if (guiState.changeToOutputStride) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.architecture,
        outputStride: +guiState.changeToOutputStride,
        inputResolution: guiState.inputResolution,
        multiplier: guiState.multiplier,
        quantBytes: guiState.quantBytes,
      });
      toggleLoadingUI(false);
      guiState.outputStride = +guiState.changeToOutputStride;
      guiState.changeToOutputStride = null;
    }

    if (guiState.changeToInputResolution) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.architecture,
        outputStride: guiState.outputStride,
        inputResolution: +guiState.changeToInputResolution,
        multiplier: guiState.multiplier,
        quantBytes: guiState.quantBytes,
      });
      toggleLoadingUI(false);
      guiState.inputResolution = +guiState.changeToInputResolution;
      guiState.changeToInputResolution = null;
    }

    if (guiState.changeToQuantBytes) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.architecture,
        outputStride: guiState.outputStride,
        inputResolution: guiState.inputResolution,
        multiplier: guiState.multiplier,
        quantBytes: guiState.changeToQuantBytes,
      });
      toggleLoadingUI(false);
      guiState.quantBytes = guiState.changeToQuantBytes;
      guiState.changeToQuantBytes = null;
    }

    let poses = [];
    let minPoseConfidence;
    let minPartConfidence;
    switch (guiState.algorithm) {
      case 'single-pose':
        const pose = await guiState.net.estimatePoses(video, {
          flipHorizontal: flipPoseHorizontal,
          decodingMethod: 'single-person',
        });
        // TODO: algo starts here
        const left = {'we': [], 'es': []};
        const right = {'we': [], 'es': []};
        const scores = [];
        if (pose[0]) {
          pose[0].keypoints.filter((keypoint) => {
            switch (keypoint.part) {
              case 'leftWrist':
                left.we.push(keypoint.position.x);
                left.we.push(keypoint.position.y);
                scores.push(keypoint.score);
                break;
              case 'leftShoulder':
                left.es.push(keypoint.position.x);
                left.es.push(keypoint.position.y);
                scores.push(keypoint.score);
                break;
              case 'leftElbow':
                left.we.push(keypoint.position.x);
                left.we.push(keypoint.position.y);
                left.es.push(keypoint.position.x);
                left.es.push(keypoint.position.y);
                scores.push(keypoint.score);
                break;
                //  right
              case 'rightWrist':
                right.we.push(keypoint.position.x);
                right.we.push(keypoint.position.y);
                scores.push(keypoint.score);
                break;
              case 'rightShoulder':
                right.es.push(keypoint.position.x);
                right.es.push(keypoint.position.y);
                scores.push(keypoint.score);
                break;
              case 'rightElbow':
                right.we.push(keypoint.position.x);
                right.we.push(keypoint.position.y);
                right.es.push(keypoint.position.x);
                right.es.push(keypoint.position.y);
                scores.push(keypoint.score);
                break;
            }
          });
          detectArmWaving(scores, left, right, btnLeft, btnRight);
        }
        //  ***************************
        poses = poses.concat(pose);
        minPoseConfidence = +guiState.singlePoseDetection.minPoseConfidence;
        minPartConfidence = +guiState.singlePoseDetection.minPartConfidence;
        break;
    }

    ctx.clearRect(0, 0, videoWidth, videoHeight);

    if (guiState.output.showVideo) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-videoWidth, 0);
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
      ctx.restore();
    }

    // For each pose (i.e. person) detected in an image, loop through the poses
    // and draw the resulting skeleton and keypoints if over certain confidence
    // scores
    poses.forEach(({score, keypoints}) => {
      if (score >= minPoseConfidence) {
        if (guiState.output.showPoints) {
          drawKeypoints(keypoints, minPartConfidence, ctx);
        }
        if (guiState.output.showSkeleton) {
          drawSkeleton(keypoints, minPartConfidence, ctx);
        }
        if (guiState.output.showBoundingBox) {
          drawBoundingBox(keypoints, ctx);
        }
      }
    });

    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}

function detectArmWaving(scores, left, right, btnL, btnR) {
  if (scores.filter((s) => s > 0.5).length == scores.length) {
    // console.log({left, right});
    left.we[1] -= left.we[3];
    left.we[3] = 0;

    left.es[0] -= left.es[2];
    left.es[2] = 0;
    const leftSimilarity = similarity(left.we, left.es);
    right.we[3] -= right.we[1];
    right.we[1] = 0;

    right.es[2] -= right.es[0];
    right.es[0] = 0;
    // console.log(changed);
    const rightSimilarity = similarity(right.we, right.es);
    if (Math.abs(rightSimilarity) < 0.1 && !changed) {
      changed = true;
      btnR.click();
      // wait(4000);
      // console.log('===>>> vertical');
    } else {
      changed = false;
      // console.log('===>>> down');
    }
    if (Math.abs(leftSimilarity) < 0.5 && Math.abs(leftSimilarity) > 0.42 &&
        !changed) {
      changed = true;
      btnL.click();
      // wait(4000);
      // console.log('<<<=== vertical');
    } else {
      // changed = false;
      // console.log('<<<=== down');
    }
  }
}

/**
 * Kicks off the demo by loading the posenet model, finding and loading
 * available camera devices, and setting off the detectPoseInRealTime function.
 */
export async function bindPage() {
  toggleLoadingUI(true);
  const net = await posenet.load();
  toggleLoadingUI(false);

  let video;

  try {
    video = await loadVideo();
  } catch (e) {
    let info = document.getElementById('info');
    info.textContent = 'this browser does not support video capture,' +
        'or this device does not have a camera';
    info.style.display = 'block';
    throw e;
  }

  setupGui([], net);
  detectPoseInRealTime(video, net);
}

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
// kick off the demo
bindPage();
