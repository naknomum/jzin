# jzinDesigner

A simple web tool for manipulating data "feeds" (images, text, etc.) into **jzin document** based on a chosen _template_.
These [feeds](../generators/feed.md) are a source-agnostic way to represent simple arrays of content-data.

## Template Chooser

First a user selects a template to apply to the data feed.  A preview of the entire document using this template is provided.
The user can manipulate the template and see the effect of these changes on the final document.

## Document Creation

When the user is happy with the template selection and adjustments, the final document is created.  The user can do further manipulations
to pages (adding, removing) and within pages (altering page contents).

The user is also allowed to insert auto-generated pages, like **table of contents**, **index**, **title pages**, and so on.


## Generating PDF

When the document is complete, the user can generate the final **jzin json file**.  They will be asked the layout and pagination they wish to
use in their final print.  The resulting jzin file can be made into a PDF using [jzin2pdf](../jzin2pdf).

## Command-line mode

_**PROPOSED:**_ A future enhancement would allow for a simplified command-line utility to take the place of **jzinDesigner** (web UI). Likely best
done in node to leverage the code in jzinDesigner.  This could have arguments to allow choosing template and other options, such as:

```
feed2jzin --template=3 --toc --index --title='New Zine' < feed.json > jzin.json
```
