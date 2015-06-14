// Generates a Gaussianly-distributed random number (mean = 0, stddev = 1).
// Uses the ziggurat method as developed by Marsaglia and Tsang.
// See: http://www.jstatsoft.org/v05/i08/paper/
var NormalVariate = function () {
  var jsr;
  var wn = Array(128);
  var fn = Array(128);
  var kn = Array(128);

  this.random = function () {
    var j = randomLong();
    var i = j & 127;
    return (Math.abs(j) < kn[i]) ? j * wn[i] : fixNormal(j, i);
  };

  // Generates a long using an inline 3-shift shift register, then coerces it to
  // a signed 32-bit int
  var randomLong = function () {
    var jz = jsr;
    jsr ^= (jsr << 13);
    jsr ^= (jsr >> 17);
    jsr ^= (jsr << 5);
    return (jz + jsr) | 0;
  };

  // Returns a random 32-bit int floated onto (0, 1).
  var uniformVariate = function () {
    return 0.5 * (1 + randomLong() * 0.2328306e-9);
  };

  var fixNormal = function (j, i) {
    var r = 3.44262;
    var x, y;
    while (true) {
      x = j * wn[i];

      if (i == 0) {
        do {
          x = -Math.log(uniformVariate()) * 0.2904754;
          y = -Math.log(uniformVariate());
        } while (y + y < x * x);
        return (j > 0) ? r + x : -r - x;
      }

      if (fn[i] + uniformVariate() * (fn[i - 1] - fn[i]) < Math.exp(-0.5 * x * x)) {
         return x;
      }

      j = randomLong();
      i = j & 127;
 
      if (Math.abs(j) < kn[i]) {
        return (j * wn[i]);
      }
    }
  };

  var setUpZiggurat = function () {
    jsr ^= new Date().getTime();

    var m1 = 2147483648.0;
    var dn = 3.442619855899;
    var tn = dn;
    var vn = 9.91256303526217e-3;
    
    var q = vn / Math.exp(-0.5 * dn * dn);
    kn[0] = Math.floor((dn/q)*m1);
    kn[1] = 0;

    wn[0] = q / m1;
    wn[127] = dn / m1;

    fn[0] = 1.0;
    fn[127] = Math.exp(-0.5 * dn * dn);

    for (var i = 126; i >= 1; i--) {
      dn = Math.sqrt(-2.0 * Math.log( vn / dn + Math.exp( -0.5 * dn * dn)));
      kn[i + 1] = Math.floor((dn / tn) * m1);
      tn = dn;
      fn[i] = Math.exp(-0.5 * dn * dn);
      wn[i] = dn / m1;
    }
  };

  setUpZiggurat();
};