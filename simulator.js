// Handles all the ugly OpenGL state.
var Simulator = function (canvas, width, height) {

  var canvas = canvas;
  canvas.width = width;
  canvas.height = height;

  var ctx;
  var sky = new Sky();
  var skyParams = sky.getSkyParams();
  var ocean = new Ocean();
  
  var currentTime = 0.0;

  var simulationProgram;
  var horizontalTransformProgram;
  var verticalTransformProgram;
  var highResolutionProgram;
  var lowResolutionProgram;
  var skyProgram;

  var initialSpectrumTexture;
  var butterflyTextures;
  var spectrumFramebuffer; 
  var spectrumTextureEven;
  var spectrumTextureOdd;
  var heightFieldTexture;

  var quadPositionBuffer;
  var quadIndicesBuffer;

  var oceanGridPositionsBuffer;
  var oceanGridTexCoordsBuffer;
  var oceanGridIndicesBuffer;

  var oceanLowResGridPositionsBuffers;
  var oceanLowResGridTexCoordsBuffers;
  var oceanLowResGridIndicesBuffers;

  var resolutionBracketDistances = [250, 1000, 2500];
  var lowerTileResolutions = [128, 32, 2];
  var centerline = vec4.fromValues(0.0, 0.0, 0.0, 1.0);
  var oceanColor = ocean.rgbColor;

  this.prepareToRender = function() {
    startGL();

    buildQuadBuffers();
    buildSimulationProgram();
    buildFftHorizontalProgram();
    buildFftVerticalProgram();
    buildSkyProgram();
    buildHighResolutionRenderProgram();
    buildLowResolutionRenderProgram();

    buildInitialSpectrumTexture();
    buildButterflyTextures();
    buildFftBuffersAndTextures();

    buildHighResolutionGrid();
    buildLowResolutionGrids();
  };

  var startGL = function () {
    ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    ctx.viewport(0, 0, canvas.width, canvas.height);
    ctx.clearColor(0.0, 0.0, 0.0, 1.0);
  };

  var buildShader = function (context, sourceSelector) {
    var source = document.querySelector(sourceSelector);
    var type = source.type === "x-shader/x-vertex" ? context.VERTEX_SHADER : context.FRAGMENT_SHADER;
    var shader = context.createShader(type);
    context.shaderSource(shader, source.textContent);
    context.compileShader(shader);
    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
      throw new Error(context.getShaderInfoLog(shader));
    }
    return shader;
  };

  var buildProgram = function (ctx, vertexShader, fragmentShader) {
    var program = ctx.createProgram();
    ctx.attachShader(program, vertexShader);
    ctx.attachShader(program, fragmentShader);
    ctx.linkProgram(program);
    if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
      throw new Error("Could not create program.");
    }
    return program;
  };

  var getAttribLocations = function (program, attribNames) {
    return getLocations(program, attribNames, ctx.getAttribLocation, ctx);
  };

  var getUniformLocations = function (program, uniformNames) {
    return getLocations(program, uniformNames, ctx.getUniformLocation, ctx);
  };

  var getLocations = function (program, names, ctxMethod, ctx) {
    var locations = {};
    for (var i = 0, n = names.length; i < n; ++i) {
      locations[names[i]] = ctxMethod.apply(ctx, [program, names[i]]);
    }
    return locations;
  };

  var buildQuadBuffers = function () {
    var quadPositions = [-1.0,-1.0,
                         -1.0, 1.0,
                          1.0, 1.0,
                          1.0,-1.0];
    
    quadPositionBuffer = ctx.createBuffer();
    ctx.bindBuffer(ctx.ARRAY_BUFFER, quadPositionBuffer);
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(quadPositions), ctx.STATIC_DRAW);
    
    var quadIndices = [0, 1, 2, 0, 2, 3];
    quadIndicesBuffer = ctx.createBuffer();
    ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, quadIndicesBuffer);   
    ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, new Uint16Array(quadIndices), ctx.STATIC_DRAW);
  };

  var buildSimulationProgram = function () {
    var simulationVertexShader = buildShader(ctx, "#quad-vertex-shader");
    var simulationFragmentShader = buildShader(ctx, "#simulation-fft-fragment-shader");

    simulationProgram = buildProgram(ctx, simulationVertexShader, simulationFragmentShader);
    simulationProgram.attribLocations = getAttribLocations(simulationProgram,
                                                           ["position"]);
    simulationProgram.uniformLocations = getUniformLocations(simulationProgram,
                                                             ["tileResolution",
                                                              "currentTime",
                                                              "simulationIndex",
                                                              "waveOffset",
                                                              "waveMultiplier"]);
 
    ctx.useProgram(simulationProgram);
    ctx.vertexAttribPointer(simulationProgram.attribLocations["position"], 2, ctx.FLOAT, false, 0, 0);
    ctx.uniform1f(simulationProgram.uniformLocations["tileResolution"], tileResolution);
    ctx.uniform1i(simulationProgram.uniformLocations["simulationIndex"], 0);
    ctx.uniform1f(simulationProgram.uniformLocations["waveOffset"], -tileResolution * 0.5);
    ctx.uniform1f(simulationProgram.uniformLocations["waveMultiplier"], τ / tileSizeInMeters);
    ctx.useProgram(null);
  };

  var buildFftHorizontalProgram = function () {
    var horizontalTransformVertexShader = buildShader(ctx, "#quad-vertex-shader");
    var horizontalTransformFragmentShader = buildShader(ctx, "#horizontal-fft-fragment-shader");

    horizontalTransformProgram = buildProgram(ctx, horizontalTransformVertexShader, horizontalTransformFragmentShader);
    horizontalTransformProgram.attribLocations = getAttribLocations(horizontalTransformProgram,
                                                                    ["position"]);
    horizontalTransformProgram.uniformLocations = getUniformLocations(horizontalTransformProgram,
                                                                      ["fftData",
                                                                       "butterflyData"]);

    ctx.useProgram(horizontalTransformProgram);
    ctx.vertexAttribPointer(horizontalTransformProgram.attribLocations["position"], 2, ctx.FLOAT, false, 0, 0);
    ctx.uniform1i(horizontalTransformProgram.uniformLocations["fftData"], 0);
    ctx.uniform1i(horizontalTransformProgram.uniformLocations["butterflyData"], 1);
    ctx.useProgram(null);
  };

  var buildFftVerticalProgram = function () {
    var verticalTransformVertexShader = buildShader(ctx, "#quad-vertex-shader");
    var verticalTransformFragmentShader = buildShader(ctx, "#vertical-fft-fragment-shader");

    verticalTransformProgram = buildProgram(ctx, verticalTransformVertexShader, verticalTransformFragmentShader);
    verticalTransformProgram.attribLocations = getAttribLocations(verticalTransformProgram,
                                                                  ["position"]);
    verticalTransformProgram.uniformLocations = getUniformLocations(verticalTransformProgram,
                                                                    ["fftData",
                                                                     "butterflyData"]);

    ctx.useProgram(verticalTransformProgram);
    ctx.vertexAttribPointer(verticalTransformProgram.attribLocations["position"], 2, ctx.FLOAT, false, 0, 0);
    ctx.uniform1i(verticalTransformProgram.uniformLocations["fftData"], 0);
    ctx.uniform1i(verticalTransformProgram.uniformLocations["butterflyData"], 1);
    ctx.useProgram(null);
  };

  var buildSkyProgram = function () {
    var skyVertexShader = buildShader(ctx, "#quad-vertex-shader");
    var skyFragmentShader = buildShader(ctx, "#sky-fragment-shader");

    skyProgram = buildProgram(ctx, skyVertexShader, skyFragmentShader);

    skyProgram.attribLocations = getAttribLocations(skyProgram,
                                                    ["position"]);
    skyProgram.uniformLocations = getUniformLocations(skyProgram,
                                                      ["eyePos",
                                                       "eyeCenter",
                                                       "sunPosition",
                                                       "eyeUp",
                                                       "fov",
                                                       "skyParams1",
                                                       "skyParams2",
                                                       "skyParams3",
                                                       "skyParams4",
                                                       "skyParams5",
                                                       "skyParams6"]);

    ctx.useProgram(skyProgram);    
    ctx.uniform3f(skyProgram.uniformLocations["sunPosition"], sunPosition[0], sunPosition[1], sunPosition[2]);
    ctx.uniform3f(skyProgram.uniformLocations["eyeUp"], up[0], up[1], up[2]);
    ctx.uniform1f(skyProgram.uniformLocations["fov"], fov / 360.0 * τ);
    ctx.uniform4f(skyProgram.uniformLocations["skyParams1"], skyParams[0][0], skyParams[0][1], skyParams[0][2], skyParams[0][3]);
    ctx.uniform4f(skyProgram.uniformLocations["skyParams2"], skyParams[1][0], skyParams[1][1], skyParams[1][2], skyParams[1][3]);
    ctx.uniform4f(skyProgram.uniformLocations["skyParams3"], skyParams[2][0], skyParams[2][1], skyParams[2][2], skyParams[2][3]);
    ctx.uniform4f(skyProgram.uniformLocations["skyParams4"], skyParams[3][0], skyParams[3][1], skyParams[3][2], skyParams[3][3]);
    ctx.uniform4f(skyProgram.uniformLocations["skyParams5"], skyParams[4][0], skyParams[4][1], skyParams[4][2], skyParams[4][3]);
    ctx.uniform4f(skyProgram.uniformLocations["skyParams6"], skyParams[5][0], skyParams[5][1], skyParams[5][2], skyParams[5][3]);
    ctx.useProgram(null);
  };

  var buildHighResolutionRenderProgram = function () {
    var highResRenderVertexShader = buildShader(ctx, "#highres-render-vertex-shader");
    var highResRenderFragmentShader = buildShader(ctx, "#highres-render-fragment-shader");

    highResolutionProgram = buildProgram(ctx, highResRenderVertexShader, highResRenderFragmentShader);

    highResolutionProgram.attribLocations = getAttribLocations(highResolutionProgram,
                                                               ["position",
                                                                "texCoord"]);

    highResolutionProgram.uniformLocations = getUniformLocations(highResolutionProgram,
                                                                 ["model",
                                                                  "modelViewPerspective",
                                                                  "simulationIndex",
                                                                  "skyParams1",
                                                                  "skyParams2",
                                                                  "skyParams3",
                                                                  "skyParams4",
                                                                  "skyParams5",
                                                                  "skyParams6",
                                                                  "eyePos",
                                                                  "deltaNorm",
                                                                  "deltaMeters",
                                                                  "oceanColor",
                                                                  "sunPosition"]);
    setStandardUniformsForRender(highResolutionProgram);
  };

  var buildLowResolutionRenderProgram = function () {
    var lowResRenderVertexShader = buildShader(ctx, "#lowres-render-vertex-shader");
    var lowResRenderFragmentShader = buildShader(ctx, "#lowres-render-fragment-shader");

    lowResolutionProgram = buildProgram(ctx, lowResRenderVertexShader, lowResRenderFragmentShader);

    lowResolutionProgram.attribLocations = getAttribLocations(lowResolutionProgram,
                                                              ["position",
                                                               "texCoord"]);

    lowResolutionProgram.uniformLocations = getUniformLocations(lowResolutionProgram,
                                                                ["model",
                                                                 "modelViewPerspective",
                                                                 "simulationIndex",
                                                                 "skyParams1",
                                                                 "skyParams2",
                                                                 "skyParams3",
                                                                 "skyParams4",
                                                                 "skyParams5",
                                                                 "skyParams6",
                                                                 "eyePos",
                                                                 "deltaNorm",
                                                                 "deltaMeters",
                                                                 "oceanColor",
                                                                 "sunPosition"]);
    setStandardUniformsForRender(lowResolutionProgram);
  };

  var setStandardUniformsForRender = function (program) {
    ctx.useProgram(program);
    ctx.uniform1f(program.uniformLocations["deltaNorm"], 1.0 / tileResolution);
    ctx.uniform1f(program.uniformLocations["deltaMeters"], tileSizeInMeters / tileResolution);
    ctx.uniform3f(program.uniformLocations["oceanColor"], oceanColor[0], oceanColor[1], oceanColor[2]);
    ctx.uniform3f(program.uniformLocations["sunPosition"], sunPosition[0], sunPosition[1], sunPosition[2]);
    ctx.uniform1i(program.uniformLocations["simulationIndex"], 2);
    ctx.uniform4f(program.uniformLocations["skyParams1"], skyParams[0][0], skyParams[0][1], skyParams[0][2], skyParams[0][3]);
    ctx.uniform4f(program.uniformLocations["skyParams2"], skyParams[1][0], skyParams[1][1], skyParams[1][2], skyParams[1][3]);
    ctx.uniform4f(program.uniformLocations["skyParams3"], skyParams[2][0], skyParams[2][1], skyParams[2][2], skyParams[2][3]);
    ctx.uniform4f(program.uniformLocations["skyParams4"], skyParams[3][0], skyParams[3][1], skyParams[3][2], skyParams[3][3]);
    ctx.uniform4f(program.uniformLocations["skyParams5"], skyParams[4][0], skyParams[4][1], skyParams[4][2], skyParams[4][3]);
    ctx.uniform4f(program.uniformLocations["skyParams6"], skyParams[5][0], skyParams[5][1], skyParams[5][2], skyParams[5][3]);
    ctx.useProgram(null);
  };

  // Save ocean wave height field values to a texture.
  var buildInitialSpectrumTexture = function () {
    var initialSpectrumArray = ocean.waveHeightSpectrum();
    initialSpectrumTexture = ctx.createTexture();

    ctx.bindTexture(ctx.TEXTURE_2D, initialSpectrumTexture);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.REPEAT);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.REPEAT);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, tileResolution, tileResolution, 0, ctx.RGBA, ctx.FLOAT, initialSpectrumArray);
    ctx.bindTexture(ctx.TEXTURE_2D, null);
  };

  // Save butterfly indices and weights for all iterations to textures.
  var buildButterflyTextures = function () {
    butterflyTextures = new Array(fftIterations);

    for (var n = 0; n < fftIterations; ++n) {
      var butterflyArray = ocean.butterflyArrayForIteration(n);
      butterflyTextures[n] = ctx.createTexture();
      ctx.bindTexture(ctx.TEXTURE_2D, butterflyTextures[n]);
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
      ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, tileResolution, tileResolution, 0, ctx.RGBA, ctx.FLOAT, butterflyArray);
    }
  };

  var buildFftBuffersAndTextures = function () {
    spectrumFramebuffer = ctx.createFramebuffer();
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, spectrumFramebuffer);
    spectrumFramebuffer.width = tileResolution;
    spectrumFramebuffer.height = tileResolution;
    
    spectrumTextureEven = ctx.createTexture();
    ctx.bindTexture(ctx.TEXTURE_2D, spectrumTextureEven);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, spectrumFramebuffer.width, spectrumFramebuffer.height, 0, ctx.RGBA, ctx.FLOAT, null);
    
    spectrumTextureOdd = ctx.createTexture();
    ctx.bindTexture(ctx.TEXTURE_2D, spectrumTextureOdd);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, spectrumFramebuffer.width, spectrumFramebuffer.height, 0, ctx.RGBA, ctx.FLOAT, null);
    
    ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, spectrumTextureEven, 0);
    
    if (ctx.checkFramebufferStatus(ctx.FRAMEBUFFER) != ctx.FRAMEBUFFER_COMPLETE) {
      throw new Error("FFT framebuffer incomplete.");
    }

    ctx.bindTexture(ctx.TEXTURE_2D, null);
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
  };

  var buildHighResolutionGrid = function () {
    oceanGridPositionsBuffer = ctx.createBuffer();
    oceanGridTexCoordsBuffer = ctx.createBuffer();
    oceanGridIndicesBuffer = ctx.createBuffer();

    populateGridBuffers(getGridParameters(tileResolution),
                        oceanGridPositionsBuffer,
                        oceanGridTexCoordsBuffer,
                        oceanGridIndicesBuffer);
  };

  var buildLowResolutionGrids = function () {
    oceanLowResGridPositionsBuffers = new Array(3);
    oceanLowResGridTexCoordsBuffers = new Array(3);
    oceanLowResGridIndicesBuffers = new Array(3);
    for (var i = 0; i < 3; ++i) buildLowResolutionGrid(i);
  };

  var buildLowResolutionGrid = function (bracket) {
    oceanLowResGridPositionsBuffers[bracket] = ctx.createBuffer();
    oceanLowResGridTexCoordsBuffers[bracket] = ctx.createBuffer();
    oceanLowResGridIndicesBuffers[bracket] = ctx.createBuffer();

    populateGridBuffers(getGridParameters(lowerTileResolutions[bracket]),
                        oceanLowResGridPositionsBuffers[bracket],
                        oceanLowResGridTexCoordsBuffers[bracket],
                        oceanLowResGridIndicesBuffers[bracket]);
  };

  var populateGridBuffers = function (gridParameters, positionsBuffer, texCoordsBuffer, indicesBuffer) {
    ctx.bindBuffer(ctx.ARRAY_BUFFER, positionsBuffer);
    ctx.bufferData(ctx.ARRAY_BUFFER, gridParameters.positions, ctx.STATIC_DRAW);
    
    ctx.bindBuffer(ctx.ARRAY_BUFFER, texCoordsBuffer);
    ctx.bufferData(ctx.ARRAY_BUFFER, gridParameters.texCoords, ctx.STATIC_DRAW);

    ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, indicesBuffer);
    ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, gridParameters.indices, ctx.STATIC_DRAW);
    indicesBuffer.numitems = gridParameters.numIndices;
  };

  var getGridParameters = function (tileResolution) {
    var positions = new Float32Array(Math.pow(tileResolution, 2) * 3);
    var texCoords = new Float32Array(Math.pow(tileResolution, 2) * 2);
    var stepSize = 0.5 / tileResolution;
    var indices = new Uint32Array((tileResolution - 1) * (tileResolution - 1) * 6);
    var currentQuad = 0;

    for (var j = 0; j < tileResolution; ++j) {
      for (var i = 0; i < tileResolution; ++i) {
        var idx = gridIndexForCoords(i, j, tileResolution);

        positions[idx * 3] = tileSizeInMeters * (j - (tileResolution - 1) * 0.5) / (tileResolution - 1);
        positions[idx * 3 + 1] = 0.0;
        positions[idx * 3 + 2] = tileSizeInMeters * (i - (tileResolution - 1) * 0.5) / (tileResolution - 1);

        texCoords[idx * 2] = (i / tileResolution) + stepSize;
        texCoords[idx * 2 + 1] = (j / tileResolution) + stepSize;

        if (j != tileResolution - 1 && i != tileResolution - 1) {
          indices[currentQuad * 6] = gridIndexForCoords(i, j, tileResolution);
          indices[currentQuad * 6 + 1] = gridIndexForCoords(i + 1, j, tileResolution);
          indices[currentQuad * 6 + 2] = gridIndexForCoords(i, j + 1, tileResolution);
          indices[currentQuad * 6 + 3] = gridIndexForCoords(i + 1, j, tileResolution);
          indices[currentQuad * 6 + 4] = gridIndexForCoords(i + 1, j + 1, tileResolution);
          indices[currentQuad * 6 + 5] = gridIndexForCoords(i, j + 1, tileResolution);
          currentQuad++;
        }
      }
    }

    return {
      positions: positions,
      texCoords: texCoords,
      indices: indices,
      numIndices: currentQuad * 6
    };
  };

  var gridIndexForCoords = function (i, j, multiplier) {
    return i + j * multiplier;
  };

  this.willAnimate = function () {
    currentTime = currentTime + 0.08;
  };
  
  this.animate = function () {
    clearContext();
    renderSky();
    renderOcean();
  };

  var clearContext = function () {
    ctx.clear(ctx.COLOR_BUFFER_BIT);
  };

  var renderSky = function () {
    ctx.disable(ctx.DEPTH_TEST);

    ctx.useProgram(skyProgram);

    ctx.bindBuffer(ctx.ARRAY_BUFFER, quadPositionBuffer);
    ctx.vertexAttribPointer(skyProgram.attribLocations["position"], 2, ctx.FLOAT, false, 0, 0);
    ctx.enableVertexAttribArray(skyProgram.attribLocations["position"]);

    ctx.uniform3f(skyProgram.uniformLocations["eyePos"], eye[0], eye[1], eye[2]);
    ctx.uniform3f(skyProgram.uniformLocations["eyeCenter"], center[0], center[1], center[2]);
    
    ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, quadIndicesBuffer);
    ctx.drawElements(ctx.TRIANGLES, 6, ctx.UNSIGNED_SHORT,0);
    ctx.disableVertexAttribArray(skyProgram.attribLocations["position"]);
  };

  var renderOcean = function () {
    runSimulationPass();
    runFftPasses();

    var currentOffset = getEyeArea();
    var spread = 8;

    ctx.viewport(0, 0, canvas.width, canvas.height);
    ctx.enable(ctx.DEPTH_TEST);
    for (var i = -spread; i <= spread; ++i) {
      for (var j = -spread; j <= spread; ++j) {
        var bracket = vertexDistanceBracket(currentOffset[0] + i, currentOffset[1] + j);
        if (bracket == -1) {
          render(highResolutionProgram,
                 tileResolution,
                 (currentOffset[0] + i) * tileSizeInMeters,
                 0,
                 (currentOffset[1] + j) * tileSizeInMeters,
                 oceanGridIndicesBuffer,
                 oceanGridPositionsBuffer,
                 oceanGridTexCoordsBuffer);
        } else {
          render(lowResolutionProgram,
                 lowerTileResolutions[bracket],
                 (currentOffset[0] + i) * tileSizeInMeters,
                 patchYOffset[bracket],
                 (currentOffset[1] + j) * tileSizeInMeters,
                 oceanLowResGridIndicesBuffers[bracket],
                 oceanLowResGridPositionsBuffers[bracket],
                 oceanLowResGridTexCoordsBuffers[bracket]);
        }
      }
    }
  };

  var getEyeArea = function () {
    var actualSize = tileSizeInMeters * patchSizeMultiplier;
    return [Math.floor((eye[0] + actualSize * 0.5) / actualSize),
            Math.floor((eye[2] + actualSize * 0.5) / actualSize)];
  };

  var vertexDistanceBracket = function (xoffset, zoffset) {
    var modelCopy = mat4.clone(model);
    var shift = vec3.fromValues(xoffset * tileSizeInMeters,
                                0,
                                zoffset * tileSizeInMeters);
    var transformed = vec4.create();

    mat4.translate(modelCopy, modelCopy, shift);
    vec4.transformMat4(transformed, centerline, modelCopy);

    var ref = vec3.fromValues(transformed[0], transformed[1], transformed[2]);
    var squaredDistance = vec3.squaredDistance(ref, eye);

    if (squaredDistance < resolutionBracketDistances[0]) return -1;
    if (squaredDistance < resolutionBracketDistances[1]) return 0;
    if (squaredDistance < resolutionBracketDistances[2]) return 1;
    return 2;
  };

  // Writes height field to spectrumTextureEven buffer.
  var runSimulationPass = function () {
    ctx.viewport(0, 0, tileResolution, tileResolution);
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, spectrumFramebuffer);

    ctx.useProgram(simulationProgram);

    ctx.enableVertexAttribArray(simulationProgram.attribLocations["position"]);

    ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, spectrumTextureEven, 0);

    ctx.uniform1f(simulationProgram.uniformLocations["currentTime"], currentTime);
    
    ctx.activeTexture(ctx.TEXTURE0);
    ctx.bindTexture(ctx.TEXTURE_2D, initialSpectrumTexture);

    ctx.drawElements(ctx.TRIANGLES, 6, ctx.UNSIGNED_SHORT,0);
    
    ctx.disableVertexAttribArray(simulationProgram.attribLocations["position"]);    
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
    ctx.useProgram(null);
  };

  var runFftPasses = function () {
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, spectrumFramebuffer);

    var isEvenStage = true;
    isEvenStage = runFftPass(horizontalTransformProgram, isEvenStage);
    isEvenStage = runFftPass(verticalTransformProgram, isEvenStage);
    heightFieldTexture = isEvenStage ? spectrumTextureEven : spectrumTextureOdd;
    
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
    ctx.useProgram(null);
  };

  var runFftPass = function (program, isEvenStage) {
    ctx.useProgram(program);
    ctx.enableVertexAttribArray(program.attribLocations["position"]);

    for (var i = 0; i < fftIterations; ++i) {
      if (isEvenStage) {           
        ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, spectrumTextureOdd, 0);
        
        ctx.activeTexture(ctx.TEXTURE0);
        ctx.bindTexture(ctx.TEXTURE_2D, spectrumTextureEven);
        
        ctx.activeTexture(ctx.TEXTURE1);
        ctx.bindTexture(ctx.TEXTURE_2D, butterflyTextures[i]);
      } else {
        ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, spectrumTextureEven, 0);
        
        ctx.activeTexture(ctx.TEXTURE0);
        ctx.bindTexture(ctx.TEXTURE_2D, spectrumTextureOdd);
        
        ctx.activeTexture(ctx.TEXTURE1);
        ctx.bindTexture(ctx.TEXTURE_2D, butterflyTextures[i]);
      }
      
      ctx.drawElements(ctx.TRIANGLES, 6, ctx.UNSIGNED_SHORT, 0);
      isEvenStage = !isEvenStage;
    }
       
    ctx.disableVertexAttribArray(program.attribLocations["position"]);
    
    return isEvenStage;
  };

  var render = function (program, tileResolution, xoffset, yoffset, zoffset, indicesBuffer, positionsBuffer, texCoordsBuffer) {
    ctx.useProgram(program);

    ctx.activeTexture(ctx.TEXTURE2);
    ctx.bindTexture(ctx.TEXTURE_2D, heightFieldTexture);

    var modelCopy = mat4.clone(model);
    var shift = vec3.fromValues(xoffset,
                                yoffset,
                                zoffset);
    var modelView = mat4.create();
    var modelViewPerspective = mat4.create();

    mat4.translate(modelCopy, modelCopy, shift);
    mat4.multiply(modelView, viewMatrix, modelCopy);
    mat4.multiply(modelViewPerspective, perspectiveMatrix, modelView);

    ctx.uniformMatrix4fv(program.uniformLocations["model"], false, modelCopy);
    ctx.uniformMatrix4fv(program.uniformLocations["modelViewPerspective"], false, modelViewPerspective);
    
    ctx.uniform3f(program.uniformLocations["eyePos"], eye[0], eye[1], eye[2]);

    ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, indicesBuffer);

    ctx.bindBuffer(ctx.ARRAY_BUFFER, positionsBuffer);
    ctx.vertexAttribPointer(program.attribLocations["position"], 3, ctx.FLOAT, false, 0, 0);
    ctx.enableVertexAttribArray(program.attribLocations["position"]);

    ctx.bindBuffer(ctx.ARRAY_BUFFER, texCoordsBuffer);
    ctx.vertexAttribPointer(program.attribLocations["texCoord"], 2, ctx.FLOAT, false, 0, 0);
    ctx.enableVertexAttribArray(program.attribLocations["texCoord"]);

    ctx.drawElements(ctx.TRIANGLES, indicesBuffer.numitems, ctx.UNSIGNED_INT,0);

    ctx.disableVertexAttribArray(program.attribLocations["position"]);
    ctx.disableVertexAttribArray(program.attribLocations["texCoord"]);
  };
};