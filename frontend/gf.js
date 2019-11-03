const STEP = 4;
const tree = [
  {
    name: 'city',
    children: [
      {
        name: 'building',
        children: [
          {
            name: 'pedestrian',
            children: [
              {
                name: 'tall person',
                children: [],
              },
              {
                name: 'short person',
                children: [],
              },
            ],
          },
          {
            name: 'car',
            children: [
              {
                name: 'tesla',
                children: [],
              },
              {
                name: 'truck',
                children: [],
              },
            ],
          },
        ],
      },
      {
        name: 'bridge',
        children: [
          {
            name: 'boat',
            children: [
              {
                name: 'yacht',
                children: [],
              },
              {
                name: 'liner',
                children: [],
              },
            ],
          },
          {
            name: 'airplane',
            children: [
              {
                name: 'f-35',
                children: [],
              },
              {
                name: 'pilot',
                children: [],
              },
            ],
          },
        ],

      },
    ],
  },
  {
    name: 'nature',
    children: [
      {
        name: 'river',
        children: [
          {
            name: 'boat',
            children: [
              {
                name: 'person',
                children: [],
              },
              {
                name: 'cat',
                children: [],
              },
            ],
          },
          {
            name: 'stone',
            children: [
              {
                name: 'volcano',
                children: [],
              },
              {
                name: 'cloud',
                children: [],
              },
            ],
          },
        ],
      },
      {
        name: 'snow mountain',
        children: [
          {
            name: 'tree',
            children: [
              {
                name: 'elephant',
                children: [],
              },
              {
                name: 'monkey',
                children: [],
              },
            ],
          },
          {
            name: 'grass',
            children: [
              {
                name: 'corn',
                children: [],
              },
              {
                name: 'happiness',
                children: [],
              },
            ],
          },
        ],

      },
    ],
  },
];

const ApiKey = 'W73hGOniFpvyIMxUq2SWb9zoe555K4vU';
const url = 'https://api.giphy.com/v1/stickers/search';

// 0 is left, 1 is right
let currentState = [];

/**
 * add 0(left) or 1(right) to currentState
 * @param dir - 0 or 1
 */
function next(dir) {
  currentState.push(dir);
}

/**
 * retrieve image from Giphy
 * @param url
 */
async function getImage(url) {
  try {
    const response = await fetch(url);
    const res = await response.json();

    let fig = document.createElement('div');
    let img = document.createElement('img');

    img.src = res.data[0].images.downsized.url;
    img.alt = res.data[0].title;
    img.width = 200;

    fig.appendChild(img);

    let out = document.querySelector('.out');
    out.insertAdjacentElement('afterbegin', fig);
  } catch (err) {
    console.error(err);
  }
}

function wait(ms)
{
  var d = new Date();
  var d2 = null;
  do { d2 = new Date(); }
  while(d2-d < ms);
}

/**
 * trigger button click event
 */
function buttonClick() {
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  btnLeft.innerHTML = tree[0].name;
  btnRight.innerHTML = tree[1].name;

  btnLeft.addEventListener('click', (event) => {
    next(0);
    if (currentState.length <= STEP) {
      const str = btnLeft.innerHTML;
      getImage(`${url}?api_key=${ApiKey}&limit=1&q=${str}`);
    }
    if (currentState.length < STEP) {
      let state = tree;
      currentState.forEach((s) => {
        state = state[s].children;
      });
      btnLeft.innerHTML = state[0].name;
      btnRight.innerHTML = state[1].name;
    }
    wait(500);
  });

  btnRight.addEventListener('click', (event) => {
    next(1);
    if (currentState.length <= STEP) {
      const str = btnRight.innerHTML;
      getImage(`${url}?api_key=${ApiKey}&limit=1&q=${str}`);
    }
    if (currentState.length < STEP) {
      let state = tree;
      currentState.forEach((s) => {
        state = state[s].children;
      });
      btnLeft.innerHTML = state[0].name;
      btnRight.innerHTML = state[1].name;
    }
    wait(500);
  });
}

function init() {
  buttonClick();
}

window.addEventListener('load', init);

