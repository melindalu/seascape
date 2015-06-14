# seascape

An implementation of Jerry Tessendorf's real-time ocean simulation techniques in WebGL.

### See the currently-running version

[Here](http://blog.melindalu.com/media/2015-06-14-seaflailing/).  
(use the arrow keys to move forward/backward/left/right; click and drag to look in a different direction; scroll up or down to rise or fall)

### To do next

* Add procedural ocean sound generator in JS
* Implement underwater lighting effects (caustics, godrays, etc.)

### References used

#### For the ocean water simulation

* Jerry Tessendorf's SIGGRAPH notes on simulating ocean water [(pdf)](http://graphics.ucsd.edu/courses/rendering/2005/jdewall/tessendorf.pdf)
* Mark Finch's piece in GPU Gems 1 on effective water simulation from physical models [(html)](http://http.developer.nvidia.com/GPUGems/gpugems_ch01.html)

#### For the sky simulation

* Sean O'Neil's piece in GPU Gems 2 on accurate atmospheric scattering [(html)](http://http.developer.nvidia.com/GPUGems2/gpugems2_chapter16.html)
* Conor Dickinson on generating procedural skies in WebGL for Cloud Party [(html)](http://www.gamasutra.com/blogs/ConorDickinson/20130919/200656/Stunning_Procedural_Skies_in_WebGL__Part_1.php)

#### On generating normally-distributed random numbers

* Marsaglia and Tsang's Ziggurat method [(pdf)](http://www.jstatsoft.org/v05/i08/paper/)

#### On shader implementation details

* Emil Persson's GDC 2013 slides on low-level thinking in high-level shading languages [(pdf)](http://www.humus.name/Articles/Persson_LowLevelThinking.pdf)

#### On OpenGL/WebGL/graphics APIs in general

* Joe Groff's [excellent introduction](http://duriansoftware.com/joe/An-intro-to-modern-OpenGL.-Table-of-Contents.html) to the OpenGL programming model
* [Real-Time Rendering](http://www.realtimerendering.com/book.html) by Tomas Akenine-Möller, Eric Haines, and Naty Hoffman