var express = require('express');
var router = express.Router();
var vision = require('./vision');

const dict = {
  'VERY_UNLIKELY': 'NO',
  'UNLIKELY': 'NO',
  'POSSIBLE': 'MAYBE',
  'VERY_LIKELY': 'YES',
  'LIKELY': 'YES',
};

/* GET home page. */
router.post('/', function(req, res, next) {
  var base64Data = req.body.imgBase64.replace(/^data:image\/png;base64,/, '');

  require('fs').writeFile('out.png', base64Data, 'base64', function(err) {
    console.log(err);
  });
  vision.vision()('out.png', 'result.jpg').then(faces => {
    res.json({
      'JOY': dict[faces[0].joyLikelihood],
      'SORROW': dict[faces[0].sorrowLikelihood],
      'ANGER': dict[faces[0].angerLikelihood],
      'SURPRISE': dict[faces[0].surpriseLikelihood],
    });
  });
});

module.exports = router;
