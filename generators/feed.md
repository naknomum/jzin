# feed.json

A "feed" json file is not an explicit/required part of jzin, but rather a convenient way to to normalize social media (and similar) stream-like lists of
data corresponding to "posts" or "articles".

It is used as the initial source data for [jzinDesigner](../jzinDesigner), which is used to populate images and text into _templates_ to create
a document.

A simple workflow example is:

* `feed.json` &rarr; jzinDesigner &rarr; `jzin.json` &rarr; `output.pdf` (which utilizes [jzin2pdf](../jzin2pdf/))

A workflow incorporating a [generator](./) to produce the feed:

* _(data source)_ &rarr; generator utility &rarr; `feed.json` &rarr; jzinDesigner &rarr; `jzin.json` &rarr; `output.pdf`

## Structure

Content and fields should be consider a work-in-progress rather than a final standard of any kind.  This is an example of a feed json file which could
be read by **jzinDesigner** as well as might be output by one of the [generators](../).

Notes follow the example.

```json
{
    "meta": {
        "title": "An example feed",
        "type": "user-generated"
    },

    "feed": [
        {
            "title": "First post!",
            "image": "image.jpg",
            "time": "2000-12-31T01:02:03-04:00",
            "caption": "Let's see if this thing is working.",
            "permaLink": "https://example.com/post/0"
        },
        {
            "title": "A follow-up entry",
            "image": "test.png",
            "author": "Fu Bar",
            "time": "2000-12-31T23:02:03-04:00",
            "caption": "Additional nonsense data",
            "permaLink": "https://example.com/post/1",
            "hashtags": ["test", "second", "jzin"]
        }
    ]
}
```
**Notes:**
* images need no path as they are assumed to be in the same directory as the feed json file
* all fields should be considered optional
* `type` in the meta data currently is unused and for reference only
* unlisted json may be added for secondary uses or notes, and should not break anything
