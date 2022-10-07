
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
        this.pageScale = 1;
        this.init();
        return this;
    }

    init() {
        let me = this;
        window.addEventListener('resize', function(ev) {
            clearTimeout(jzinDesigner.resizeTimer);
            jzinDesigner.resizeTimer = setTimeout(function() {
                if (me.currentPage > -1) me.displayPage(me.currentPage);
            }, 300);
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
        let doc = {'document': {'pages': []}};
        for (let i = 0 ; i < jzinDesigner.templates[tnum].document.pages.length ; i++) {
            let pg = JSON.parse(JSON.stringify(jzinDesigner.templates[tnum].document.pages[i]));
            for (let j = 0 ; j < pg.elements.length ; j++) {
                let field = pg.elements[j].field;
                delete pg.elements[j].field;
                pg.elements[j] = this.generateElement(pg.elements[j], field, this.feed.feed[0]);
            }
            doc.document.pages.push(pg);
        }
        this.doc = doc;
        this.displayPage(0);
    }

    generateElement(elTemplate, fieldName, data) {
        let el = JSON.parse(JSON.stringify(elTemplate));
        el[elTemplate.elementType] = data[fieldName];
        //console.info('>>>> A(%o) B(%o) C(%o)', elTemplate, fieldName, data);
        return el;
    }

    displayPage(pnum) {
        this.currentPage = pnum;
        console.log('DISPLAYING PAGE %d: %o', pnum, this.doc.document.pages[pnum]);
        if (this.pageBackdrop) this.pageBackdrop.remove();
        this.pageBackdrop = document.createElement('div');
        this.pageBackdrop.setAttribute('class', 'jzd-page-backdrop');
        this.el.appendChild(this.pageBackdrop);
        let pgw = this.doc.document.pages[pnum].size[3] - this.doc.document.pages[pnum].size[1];
        let pgh = this.doc.document.pages[pnum].size[2] - this.doc.document.pages[pnum].size[0];
        let rh = this.pageBackdrop.clientHeight / pgh;
        let rw = this.pageBackdrop.clientWidth / pgw;
        this.pageScale = Math.min(rh, rw);
        this.pageBackdrop.style.width = pgw * this.pageScale;
        this.pageBackdrop.style.height = pgh * this.pageScale;

        for (let i = 0 ; i < this.doc.document.pages[pnum].elements.length ; i++) {
            this.addElement(this.doc.document.pages[pnum].elements[i], i);
        }
    }

    addElement(elData, depth) {
        let el = null;
        if (elData.elementType == 'image') {
            el = this.addImageElement(elData);
        } else if (elData.elementType == 'text') {
            el = this.addTextElement(elData);
        } else {
            console.warn('unknown elementType=%s in %o', elData.elementType, elData);
            return;
        }
        el.style.zIndex = depth;
    }

    elementContainer(elData) {
        let el = document.createElement('div');
        el.setAttribute('class', 'jzd-element-container');
        el.style.left = elData.position[0] * this.pageScale;
        el.style.top = elData.position[1] * this.pageScale;
        el.style.width = elData.width * this.pageScale;
        el.style.height = elData.height * this.pageScale;
        return el;
    }

    addImageElement(elData) {
        let el = this.elementContainer(elData);
        let img = document.createElement('img');
        img.setAttribute('class', 'jzd-image');
        img.src = this.dataDirUrl + '/' + elData.image;
        el.appendChild(img);
        this.pageBackdrop.appendChild(el);
        return el;
    }

    addTextElement(elData) {
        let el = this.elementContainer(elData);
        el.innerHTML = elData.text;
        el.style.fontSize = elData.fontSize * this.pageScale;
        this.pageBackdrop.appendChild(el);
        return el;
    }


    static uuidv4() {  // h/t https://stackoverflow.com/a/2117523
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }
}


