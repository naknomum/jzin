# jzin

![jzin logo](docs/jzin-300.png)

**jzin** is ultimately a script to convert specially-formatted JSON into a PDF.  Specifically, these PDFs are expected to be used
to print as books, small booklets, zines, etc.   As such, it also handles complex layout and page ordering in order to facilitate
concepts like N-up printing, signatures, and so on.

![diagram showing jzin creating a pdf](docs/overview.png)

## jzin2pdf

This is the main script which generates the PDF based on the [jzin JSON file](docs/jzin.md).
It does this with the powerful perl module [PDF::API2](https://metacpan.org/pod/PDF::API2).


## jzinDesigner

This is a web app used to manipulate jzin files via a simple user interface.


## Generators

The [generators](generators/) directory contains tools to create jzin from various sources of data, such as social media feeds, etc.


### More info

Information and demonstrations can be found at [jzin.org](https://jzin.org).


---------------------

### To-Do: pre-launch

* ~~Instagram import~~
* ~~RSS import~~
* ~~Strip newlines from text~~
* ~~Gutters~~
* ~~Preferences~~
  * ~~Language~~
* ~~Template pager disabled on 1-page templates~~
* ~~Better text UI~~
  * Deprecate overflow/wrap for now (?)
* ~~Fix doc buttons to be toggles instead (e.g. index page)~~
  * ~~TOC should be disabled until chapter pages exist~~
* ~~Image UI~~
  * Better image options (fitInto etc)
* ~~Add/Remove elements on page~~
  * ~~Expand undo buffer~~
* UTF-8 not working on feeds (e.g. RSS)
* Book signatures (hopefully)
* Bug squashing
  * ~~Remove delete from template-edit mode (image/text)~~
  * Move page should be disabled for special pages (index, TOC)
  * Delete pages should delete "companions" (e.g. back of chapter page)
  * ~~Disable/cursor/wait while printing~~
* ~~Web presence (minimal)~~

### To-Do: future wishlist

* Add images (url, upload, paste) 
* Add fonts (url, upload)
* Index/toc field on text (and image?) options
* Edit font/style of index/chapter/toc/etc sticks
* Allow delete/add of elements in template mode
* SVG support
* Mixed fonts/weight/etc
  * Markdown support
  * Emoji
* Twitter import
* Halftoning of images (in frontend/js? backend?)
* Clipping images
* TOC into PDF
* Web presence - expanded
* Graphic support (lines, circles, etc.)
* Rotation
* Maybe improvements to have real undo? (all operations)
* Handle multi-image posts (e.g. Instagram carousels)

