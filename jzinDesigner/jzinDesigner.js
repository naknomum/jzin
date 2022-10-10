
class jzinDesigner {

    static fonts = null;

    static numTemplates = 3;
    static templates = [];

    static resizeTimer = null;

    constructor(el, dataDirUrl) {
        this.el = el;
        this.pageBackdrop = null;
        this.pageCurrent = 0;
        this.dataDirUrl = dataDirUrl;
        this.feed = null;
        this.doc = null;
        this.activeTemplate = null;
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
        this.uiEl.style.width = '300px';
        this.uiEl.style.height = '400px';
        this.uiEl.style.top = '10px';
        this.uiEl.style.right = '10px';
        this.uiEl.style.backgroundColor = 'rgba(240,240,240,0.6)';
        this.uiEl.style.padding = '3px';
        this.uiEl.setAttribute('class', 'jzd-ui');
        this.el.appendChild(this.uiEl);
        new Draggy(this.uiEl, false, true);

        this.previewWrapper = document.createElement('div');
        this.previewWrapper.setAttribute('class', 'jzd-page-preview-wrapper');
        this.el.appendChild(this.previewWrapper);

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
        this.uiEl.innerHTML = '';
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
        this.uiEl.style.zIndex = 1000;
        this.uiEl.style.overflow = 'hidden';
        let bwrapper = document.createElement('div');
        bwrapper.style.padding = '4px';
        let b = document.createElement('button');
        b.innerHTML = '<';
        b.addEventListener('click', function(ev) { me.pageChange(-1); });
        bwrapper.appendChild(b);
        b = document.createElement('div');
        b.style.margin = '0 8px';
        b.style.display = 'inline-block';
        b.setAttribute('class', 'jzd-page-current');
        b.innerHTML = '0';
        bwrapper.appendChild(b);
        b = document.createElement('button');
        b.innerHTML = '>';
        b.addEventListener('click', function(ev) { me.pageChange(1); });
        bwrapper.appendChild(b);
        this.uiEl.appendChild(bwrapper);
        this.chooseTemplate(0);
    }

    pageChange(delta) {
        let goPg = this.pageCurrent;
        goPg += delta;
        let max = this.pageMax();
        if (goPg < 0) goPg = max;
        if (goPg > max) goPg = 0;
        this.pageGo(goPg);
    }

    pageMax() {
        if (this.activeTemplate == null) return this.doc.document.pages.length - 1;
        return jzinDesigner.templates[this.activeTemplate].document.pages.length - 1;
    }

    pageGo(pnum) {
        if (pnum == this.pageCurrent) return;
        this.pageCurrent = pnum;
        this.resetPageBackdrop();
        this.setPageDisplay(pnum);
        this.displayPage(this.pageCurrent, this.pageBackdrop, this.doc, true);
    }

    setPageDisplay(pnum) {
        let els = document.getElementsByClassName('jzd-page-current');
        for (let i = 0 ; i < els.length ; i++) {
            els[i].innerHTML = (pnum+1) + ' / ' + (this.pageMax()+1);
        }
    }

    chooseTemplate(tnum) {
        console.log('>>>> switch to template %o', tnum);
        let templateFeed = [
		{
			"image": "templates/image-placeholder.png",
			"author": "{author0}",
			"title": "{title0}",
			"caption": "{The caption for Item 0}",
			"time": "1999-12-31T00:00:00+00:00",
			"hashtags": [ "hashtag", "tag", "jzin", "item0" ]
		},
		{
			"image": "templates/image-placeholder.png",
			"author": "{author1}",
			"title": "{title1}",
			"caption": "{The caption for Item 1}",
			"time": "1999-12-31T01:01:01+00:00",
			"hashtags": [ "hashtag", "tag", "jzin", "item1" ]
		}
        ];
        //let templateDoc = this.docFromTemplate(jzinDesigner.templates[tnum], templateFeed);
        this.activeTemplate = tnum;
        this.doc = this.docFromTemplate(jzinDesigner.templates[tnum], templateFeed);
        this.resetPageBackdrop();
        this.pageCurrent = 0;
        this.setPageDisplay(0);
        this.displayPage(0, this.pageBackdrop, this.doc, true);

        let previewDoc = this.docFromTemplate(jzinDesigner.templates[tnum], this.feed.feed);
        this.previewPages(previewDoc);
    }

    previewPages(doc) {
        this.previewWrapper.innerHTML = '';
        for (let i = 0 ; i < doc.document.pages.length ; i++) {
            let el = document.createElement('div');
            el.setAttribute('class', 'jzd-page-preview');
            el.title = 'P.' + i;
            this.previewWrapper.appendChild(el);
            el.style.height = el.clientWidth + 'px';
            this.displayPage(i, el, doc);
        }
    }

    docFromTemplate(tempDoc, feed) {
        console.warn('----------------- %o %o', tempDoc, feed);
        let doc = jzinDesigner.cloneObject(tempDoc);
        doc.document.pages = [];
        let feedOffset = 0;
        while (feedOffset < feed.length) {
            let itemsPerPage = 0;
            for (let pgNum = 0 ; pgNum < tempDoc.document.pages.length ; pgNum++) {
                let newPage = jzinDesigner.cloneObject(tempDoc.document.pages[pgNum]);
                for (let i = 0 ; i < newPage.elements.length ; i++) {
                    let field = newPage.elements[i].field;
                    let elType = newPage.elements[i]['elementType'];
                    let itemOffset = newPage.elements[i].itemOffset || 0;
                    if (itemOffset > itemsPerPage) itemsPerPage = itemOffset;
                    delete newPage.elements[i].field;
                    let offset = feedOffset + itemOffset;
                    console.log('>>>>>> FEED[%d][%s] %o ???', offset, field, feed[offset]);
                    if (!feed[offset]) {  // means we are past end of feed for this page
                        newPage.elements[i].hidden = true;
                        continue;
                    }
                    newPage.elements[i][elType] = feed[offset][field] || null;
                    console.log('       PAGE[%d] els: %o ???', doc.document.pages.length, newPage.elements);
                }
                doc.document.pages.push(newPage);
            }
            console.log('######## %d', itemsPerPage);
            feedOffset += itemsPerPage + 1;
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

    displayPage(pnum, containerEl, doc, editable) {
        if (!doc) doc = this.doc;
        console.log('DISPLAYING PAGE %d on %o: %o', pnum, containerEl, doc.document.pages[pnum]);

        let pgw = doc.document.pages[pnum].size[3] - doc.document.pages[pnum].size[1];
        let pgh = doc.document.pages[pnum].size[2] - doc.document.pages[pnum].size[0];
        this.setScale(containerEl, pgw, pgh);

        for (let i = 0 ; i < doc.document.pages[pnum].elements.length ; i++) {
            let added = this.addElement(containerEl, doc.document.pages[pnum].elements[i], i);
            if (added) {
                if (editable && added) new Draggy(added);
                added.title = 'p' + pnum + ' el' + i + ' ' + added.title;
            }
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
        if (elData.hidden) return;
        let el = null;
        if (elData.elementType == 'image') {
            el = this.addImageElement(containerEl, elData);
        } else if (elData.elementType == 'text') {
            el = this.addTextElement(containerEl, elData);
        } else {
            console.warn('unknown elementType=%s in %o', elData.elementType, elData);
            return;
        }
        el.style.zIndex = depth;
        el.title = elData.elementType + ' [depth ' + depth + ']';
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


