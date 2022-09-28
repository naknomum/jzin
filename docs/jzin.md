:warning: THIS IS A VERY EARLY DRAFT


# jzin format

jzin is JSON file whose contents direct `json2pdf` on how to create a PDF.

It contains the following top-level keys:
* `meta`
* `template` _(optional)_
* `maps`
* `document`


## meta

Contains some basic info about the jzin, such as `title`.


## template

Provides some information about how the pages were constructed.


## maps

Defines some complex items used later in the `document`, such as `fonts` and `images`.


## document

Contains an array called `pages`, with each page object in turn containing an array called `elements`.
It is these _elements_ which ultimately define what is placed on the page and how.


## elements

### text

### image

