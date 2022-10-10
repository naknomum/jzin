# jzinDesigner

A simple web tool for manipulating data "feeds" (images, text, etc.) into **jzin document** based on a chosen _template_.

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
