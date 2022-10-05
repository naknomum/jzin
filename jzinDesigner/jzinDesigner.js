
class jzinDesigner {

    static fonts = {};

    static numTemplates = 2;
    static templates = [];

    constructor(el, assetsDataUrl) {
        this.el = el;
        this.assetsDataUrl = assetsDataUrl;
        this.init();
        return this;
    }

    init() {
        this.initTemplates();
        this.initFonts();
    }

    initTemplates() {
        for (let i = 0 ; i < jzinDesigner.numTemplates ; i++) {
            console.debug('reading template %d', i);
            fetch('templates/' + i + '.json')
                .then((resp) => resp.json())
                .then((data) => this.gotTemplate(i, data));
        }
    }

    initFonts() {
        fetch('fonts/data.json')
            .then((resp) => resp.json())
            .then((data) => this.initFont(data));
    }

    initFont(fdata) {
        console.log('FONT DATA: %o', fdata);
    }

    gotTemplate(i, tdata) {
        console.debug('template %d: %s', i, tdata.meta.title);
        jzinDesigner.templates[i] = tdata;
    }

    static uuidv4() {  // h/t https://stackoverflow.com/a/2117523
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }
}


