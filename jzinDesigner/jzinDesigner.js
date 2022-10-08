
class jzinDesigner {

    static fonts = null;

    static numTemplates = 2;
    static templates = [];

    static resizeTimer = null;

    constructor(el, dataDirUrl) {
        this.el = el;
        this.pageBackdrop = null;
        this.dataDirUrl = dataDirUrl;
        this.feed = null;
        this.doc = null;
        this.currentPage = -1;
        //this.pageScale = 1;
        this.init();
        return this;
    }

    init() {
        let me = this;
        window.addEventListener('resize', function(ev) {
            clearTimeout(jzinDesigner.resizeTimer);
            jzinDesigner.resizeTimer = setTimeout(function() { me.windowResized(ev); }, 600);
        });
        if (!this.el.style.position) this.el.style.position = 'relative';
        this.uiEl = document.createElement('div');
        this.uiEl.style.position = 'absolute';
        this.uiEl.style.width = '200px';
        this.uiEl.style.height = '99%';
        this.uiEl.style.backgroundColor = 'rgba(240,240,240,0.6)';
        this.uiEl.style.display = 'none';
        this.uiEl.style.padding = '3px';
        this.uiEl.setAttribute('class', 'jzd-ui');
        this.el.appendChild(this.uiEl);

        this.initTemplates();
        this.initFonts();
        this.initFeed();
        this.initDoc();
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
            .then((data) => this.gotFonts(data));
    }

    initFeed() {
        fetch(this.dataDirUrl + '/feed.json')
            .then((resp) => resp.json())
            .then((data) => this.gotFeed(data));
    }

    gotFeed(data) {
        console.log('FEED DATA: %o', data);
        this.feed = data;
        this.initUI();
    }

    initDoc() {
        fetch(this.dataDirUrl + '/doc.json')
            .then((resp) => resp.json())
            .then((data) => this.gotDoc(data))
            .catch((error) => { this.doc = {}; console.warn('reading doc: %s', error) });
    }

    gotDoc(data) {
        console.log('DOC DATA: %o', data);
        this.doc = data;
        this.initUI();
    }

    gotFonts(fdata) {
        console.log('FONT DATA: %o', fdata);
        jzinDesigner.fonts = fdata;
        this.initUI();
    }

    gotTemplate(i, tdata) {
        console.debug('template %d: %s', i, tdata.meta.title);
        jzinDesigner.templates[i] = tdata;
        this.initUI();
    }

    initUI() {
        if (jzinDesigner.templates.length < jzinDesigner.numTemplates) return;
        for (let i = 0 ; i < jzinDesigner.templates.length ; i++) {
            if (!jzinDesigner.templates[i]) return;
        }
        if (!jzinDesigner.fonts) return;
        if (!this.feed) return;
        if (!this.doc) return;

        // have everything we need
        if (this.doc.pages) {
            this.initDocUI();
        } else {
            this.initTemplateUI();
        }
    }

    initTemplateUI() {
        this.uiEl.innerHTML = '<b style="display: block; height: 23px;"><span style="cursor: pointer;" class="jzd-option-toggle">&#x25BC;</span> OPTIONS</b>';
        let tsel = document.createElement('select');
        for (let i = 0 ; i < jzinDesigner.templates.length ; i++) {
            let topt = document.createElement('option');
            topt.setAttribute('value', i);
            topt.innerHTML = jzinDesigner.templates[i].meta.title;
            tsel.appendChild(topt);
        }
        this.uiEl.appendChild(tsel);
        let me = this;
        tsel.addEventListener('change', function(ev) { me.chooseTemplate(parseInt(ev.target.value)) });
        this.uiEl.getElementsByClassName('jzd-option-toggle')[0].addEventListener('click', function(ev) { me.toggleOption() });
        this.uiEl.style.zIndex = 1000;
        this.uiEl.style.overflow = 'hidden';
        this.uiEl.style.display = null;
        this.chooseTemplate(0);
    }

    toggleOption() {
        if (this.uiEl.clientHeight > 100) {
            this.uiEl.style.height = 20;
            this.uiEl.getElementsByClassName('jzd-option-toggle')[0].innerHTML = '&#x25BA;';
        } else {
            this.uiEl.style.height = '100%';
            this.uiEl.getElementsByClassName('jzd-option-toggle')[0].innerHTML = '&#x25BC;';
        }
    }

    chooseTemplate(tnum) {
        console.log('>>>> switch to template %o', tnum);
        let feed = [
		{
			"image": "templates/image-placeholder.png",
			"author": "{author}",
			"title": "{title}",
			"caption": "{caption}",
			"time": "1999-12-31T00:01:02+00:00",
			"hashtags": [ "hashtag", "tag", "jzin" ]
		}
        ];
        let doc = this.docFromTemplate(jzinDesigner.templates[tnum], feed);
        this.resetPageBackdrop();
        this.displayPage(0, this.pageBackdrop, doc);
    }

    docFromTemplate(tempDoc, feed) {
        let doc = jzinDesigner.cloneObject(tempDoc);
        let feedOffset = 0;
        while (feedOffset < feed.length) {
            let itemsPerPage = 1;
            for (let pgNum = 0 ; pgNum < doc.document.pages.length ; pgNum++) {
                for (let i = 0 ; i < doc.document.pages[pgNum].elements.length ; i++) {
                    let field = doc.document.pages[pgNum].elements[i].field;
                    let elType = doc.document.pages[pgNum].elements[i]['elementType'];
                    let offset = doc.document.pages[pgNum].elements[i].itemOffset || 0;
                    if (offset > itemsPerPage) itemsPerPage = offset;
                    delete doc.document.pages[pgNum].elements[i].field;
                    doc.document.pages[pgNum].elements[i][elType] = feed[feedOffset + offset][field] || null;
                    //console.log('>>>>FEED %s[%d] %o ???', field, feedOffset + offset, feed[feedOffset + offset]);
                    //console.log('>>>>>>>> %o ???', doc.document.pages[pgNum].elements[i]);
                }
            }
            feedOffset += itemsPerPage;
        }
        return doc;
    }

    resetPageBackdrop() {
        if (this.pageBackdrop) this.pageBackdrop.remove();
        this.pageBackdrop = document.createElement('div');
        this.pageBackdrop.setAttribute('class', 'jzd-page-backdrop');
        this.el.appendChild(this.pageBackdrop);
        return this.pageBackdrop;
    }

    generateElement(elTemplate, fieldName, data) {
        let el = jzinDesigner.cloneObject(elTemplate);
        el[elTemplate.elementType] = data[fieldName];
        //console.info('>>>> A(%o) B(%o) C(%o)', elTemplate, fieldName, data);
        return el;
    }

    displayPage(pnum, containerEl, doc) {
        if (!doc) doc = this.doc;
        console.log('DISPLAYING PAGE %d on %o: %o', pnum, containerEl, doc.document.pages[pnum]);

        let pgw = doc.document.pages[pnum].size[3] - doc.document.pages[pnum].size[1];
        let pgh = doc.document.pages[pnum].size[2] - doc.document.pages[pnum].size[0];
        this.setScale(containerEl, pgw, pgh);

        for (let i = 0 ; i < doc.document.pages[pnum].elements.length ; i++) {
            this.addElement(containerEl, doc.document.pages[pnum].elements[i], i);
        }
    }

    setScale(el, w, h) {
        let pgw = w || el.dataset.pageWidth || 0;
        let pgh = h || el.dataset.pageHeight || 0;
        let rh = el.clientHeight / pgh;
        let rw = el.clientWidth / pgw;
        let scale = Math.min(rh, rw);
        el.style.width = pgw * scale;
        el.style.height = pgh * scale;
        el.dataset.scale = scale;
        el.dataset.pageWidth = pgw;
        el.dataset.pageHeight = pgh;
        return scale;
    }

    addElement(containerEl, elData, depth) {
        let el = null;
        if (elData.elementType == 'image') {
            el = this.addImageElement(containerEl, elData);
        } else if (elData.elementType == 'text') {
            el = this.addTextElement(containerEl, elData);
        } else {
            console.warn('unknown elementType=%s in %o', elData.elementType, elData);
            return;
        }
        new Draggy(el);
        el.style.zIndex = depth;
        return el;
    }

    elementContainerSetSize(el, parentEl) {
        if (!parentEl) parentEl = el.parentElement;
        let scale = parentEl.dataset.scale || 1;
        el.style.left = scale * el.dataset.positionX;
        el.style.top = scale * el.dataset.positionY;
        el.style.width = scale * el.dataset.width;
        el.style.height = scale * el.dataset.height;
    }

    elementContainer(containerEl, elData) {
        let el = document.createElement('div');
        el.setAttribute('class', 'jzd-element-container');
        el.dataset.positionX = elData.position[0];
        el.dataset.positionY = elData.position[1];
        el.dataset.width = elData.width;
        el.dataset.height = elData.height;
        this.elementContainerSetSize(el, containerEl);
        return el;
    }

    addImageElement(containerEl, elData) {
        let el = this.elementContainer(containerEl, elData);
        let img = document.createElement('img');
        img.setAttribute('class', 'jzd-image');
        let src = elData.image;
        if (src.indexOf('/') < 0) src = this.dataDirUrl + '/' + src;
        img.src = src;
        el.appendChild(img);
        containerEl.appendChild(el);
        return el;
    }

    addTextElement(containerEl, elData) {
        let el = this.elementContainer(containerEl, elData);
        let scale = containerEl.dataset.scale || 1;
        el.innerHTML = elData.text;
        el.style.fontSize = elData.fontSize * scale;
        containerEl.appendChild(el);
        return el;
    }

    resizeEl(el) {
        console.info('resizing: %o', el);
        this.setScale(el);
        let els = el.getElementsByClassName('jzd-element-container');
        for (let i = 0 ; i < els.length ; i++) {
            this.elementContainerSetSize(els[i], el);
        }
    }

    windowResized(ev) {
        let els = document.body.getElementsByClassName('jzd-page-backdrop');
        for (let i = 0 ; i < els.length ; i++) {
            els[i].style.width = null;
            els[i].style.height = null;
            this.resizeEl(els[i]);
        }
    }

    static cloneObject(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    static uuidv4() {  // h/t https://stackoverflow.com/a/2117523
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }
}


