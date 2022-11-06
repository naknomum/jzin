
class jzinDesigner {

    static fonts = null;
    static fontSelect = null;

    static numTemplates = 3;
    static templates = [];

    static resizeTimer = null;

    static templateFeed = [
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

    constructor(el, dataDirUrl) {
        this.el = el;
        this.pageBackdrop = null;
        this.pageCurrent = 0;
        this.dataDirUrl = dataDirUrl;
        this.feed = null;
        this.doc = null;
        this.activeTemplate = null;
        this.activeElement = null;
        this.init();
        return this;
    }

    init() {
        let me = this;
        window.addEventListener('resize', function(ev) {
            clearTimeout(jzinDesigner.resizeTimer);
            jzinDesigner.resizeTimer = setTimeout(function() { me.windowResized(ev); }, 600);
        });
        this.el.addEventListener('click', function(ev) {
            me.activateElement(null);
        });

        // for resize movements
        this.el.addEventListener('mousemove', function(ev) { me.cornerEvent(ev); });
        this.el.addEventListener('mouseup', function(ev) { me.cornerEvent(ev); });

        if (!this.el.style.position) this.el.style.position = 'relative';
        this.uiEl = document.createElement('div');
        this.uiEl.style.position = 'absolute';
        this.uiEl.style.width = '300px';
        this.uiEl.style.height = '400px';
        this.uiEl.style.top = '10px';
        this.uiEl.style.right = '50%';
        this.uiEl.style.backgroundColor = 'rgba(240,240,240,0.6)';
        this.uiEl.style.padding = '3px';
        this.uiEl.setAttribute('class', 'jzd-ui');
        this.uiEl.addEventListener('click', function(ev) { ev.stopPropagation(); });
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
            let local = JSON.parse(localStorage.getItem('template' + i));
            if (local) {
                console.info('using localStorage for template %d: %o', i, local);
                this.gotTemplate(i, local);
            } else {
                fetch('templates/' + i + '.json')
                    .then((resp) => resp.json())
                    .then((data) => this.gotTemplate(i, data));
            }
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
        jzinDesigner.fontSelect = document.createElement('select');
        let ssheet = null;
        for (let i = 0 ; i < document.styleSheets.length ; i++) {
            if (document.styleSheets[i].title == 'jzd-main') ssheet = document.styleSheets[i];
        }
        if (!ssheet) alert('styleSheet fail');
        jzinDesigner.fonts = fdata;
        for (let i = 0 ; i < fdata.length ; i++) {
            if (fdata[i]['built-in']) continue;  // TODO support internal fonts
            let name = fdata[i].name;
            for (let key in fdata[i]) {
                if (key == 'name') continue;
                let opt = document.createElement('option');
                let fontFamilyName = name + ' ' + key;
                opt.value = fontFamilyName;
                opt.innerHTML = name + ' (' + key + ')';
                jzinDesigner.fontSelect.appendChild(opt);
                let rule = '@font-face { font-family: "' + fontFamilyName + '"; ';
                for (let ffkey in fdata[i][key]['font-face']) {
                    if (ffkey == 'src') {
                        rule += 'src: url("' + fdata[i][key]['font-face'].src + '") format("woff"); ';
                    } else {
                        rule += ffkey + ': "' + fdata[i][key]['font-face'][ffkey] + '"; ';
                    }
                }
                rule += ' }';
                ssheet.insertRule(rule, 0);
            }
        }
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
        this.setUI();
        this.chooseTemplate(0);
    }

    setUI(el) {
        if (!el) {
            if (this.activeTemplate || !this.doc.pages) {
                this.initTemplateUI();
            } else {
                this.initDocUI();
            }
            return;
        }
        let ident = el.id.split('.');
        let elData = this.doc.document.pages[ident[0]].elements[ident[1]];
        //this.uiEl.innerHTML = el.id + ':' + JSON.stringify(elData);
        if (elData.elementType == 'image') {
            this.setUIImage(el, elData, ident[0], ident[1]);
        } else {
            this.setUIText(el, elData, ident[0], ident[1]);
        }
    }

    setUIImage(el, elData, pgNum, elNum) {
        this.uiEl.innerHTML = pgNum + ',' + elNum + ':' + JSON.stringify(elData);
    }

    setUIText(el, elData, pgNum, elNum) {
        this.uiEl.innerHTML = '';
        let fsel = jzinDesigner.fontSelect.cloneNode(true);
        let me = this;
        let scale = parseFloat(el.parentElement.dataset.scale);

        fsel.addEventListener('change', function(ev) {
            let ptr = me.elementPointer(pgNum, elNum);
            ptr.font = ev.target.value;
            me.setTextElementStyle(el, ptr);
            me.elementChanged(el);
        });
        this.uiEl.appendChild(fsel);

        let asel = document.createElement('select');
        asel.innerHTML = '<option>left</option><option>center</option><option>right</option>';
        asel.value = (elData.options && elData.options.align) || 'left';
        asel.addEventListener('change', function(ev) {
            let ptr = me.elementPointer(pgNum, elNum);
            let opts = ptr.options || {};
            opts.align = ev.target.value;
            ptr.options = opts;
            me.setTextElementStyle(el, ptr);
            me.elementChanged(el);
        });
        this.uiEl.appendChild(asel);

        let sizeInp = document.createElement('input');
        sizeInp.style.width = '3em';
        sizeInp.value = elData.fontSize || 20;
        sizeInp.addEventListener('change', function(ev) {
            let ptr = me.elementPointer(pgNum, elNum);
            ptr.fontSize = parseInt(ev.target.value);
            me.setTextElementStyle(el, ptr);
            me.elementChanged(el);
        });
        this.uiEl.appendChild(sizeInp);

        let pcheck = document.createElement('input');
        pcheck.setAttribute('type', 'checkbox');
        pcheck.setAttribute('title', 'paragraph (wrap)');
        if (elData.textType == 'paragraph') pcheck.setAttribute('checked', null);
        pcheck.addEventListener('change', function(ev) {
            let ptr = me.elementPointer(pgNum, elNum);
            if (ev.target.checked) {
                ptr.textType = 'paragraph';
            } else {
                delete ptr.textType;
            }
            me.setTextElementStyle(el, ptr);
            me.elementChanged(el);
        });
        this.uiEl.appendChild(pcheck);

        let ocheck = document.createElement('input');
        ocheck.setAttribute('type', 'checkbox');
        ocheck.setAttribute('title', 'overflow');
        if (elData.overflow) ocheck.setAttribute('checked', null);
        ocheck.addEventListener('change', function(ev) {
            let ptr = me.elementPointer(pgNum, elNum);
            ptr.overflow = ev.target.checked;
            me.setTextElementStyle(el, ptr);
            me.elementChanged(el);
        });
        this.uiEl.appendChild(ocheck);
    }

    initTemplateUI() {
        this.uiEl.innerHTML = '';
        let tsel = document.createElement('select');
        for (let i = 0 ; i < jzinDesigner.templates.length ; i++) {
            let topt = document.createElement('option');
            if (i == this.activeTemplate) topt.setAttribute('selected', '');
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
        b.innerHTML = '-';
        bwrapper.appendChild(b);
        b = document.createElement('button');
        b.innerHTML = '>';
        b.addEventListener('click', function(ev) { me.pageChange(1); });
        bwrapper.appendChild(b);
        this.uiEl.appendChild(bwrapper);
        this.setPageDisplay(this.pageCurrent || 0);
        b = document.createElement('button');
        b.innerHTML = 'Create Document from Template';
        b.addEventListener('xclick', function(ev) { });
        this.uiEl.appendChild(b);
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
        if (!this.doc || !this.doc.document || !this.doc.document.pages) return 0;
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
        this.activeTemplate = tnum;
        this.doc = this.docFromTemplate(jzinDesigner.templates[tnum], jzinDesigner.templateFeed);
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

        let me = this;
        for (let i = 0 ; i < doc.document.pages[pnum].elements.length ; i++) {
            let added = this.addElement(containerEl, doc.document.pages[pnum].elements[i], i);
            if (added) {
                if (editable) {
                    new Draggy(added);
                    added.addEventListener('draggy.moved', function(ev) { me.elementMoved(ev); });
                    added.addEventListener('click', function(ev) { me.elementClicked(ev); });
                }
                added.id = pnum + '.' + i;
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

    elementMoved(ev) {
        let ident = ev.target.id.split('.');
        //console.log('MMMM %o %o %s', ev.target.id, ident, ev.target.parentElement.dataset.scale);
        let newX = parseFloat(ev.target.style.left) / ev.target.parentElement.dataset.scale;
        let newY = (ev.target.parentElement.clientHeight - parseFloat(ev.target.style.top) - ev.target.clientHeight) / ev.target.parentElement.dataset.scale;
        let ptr = this.elementPointer(ident[0], ident[1]);
        ptr.position[0] = newX;
        ptr.position[1] = newY;
        this.elementChanged(ev.target);
        ev.target.dataset.justMoved = true;
    }

    elementResized(el) {
        let ident = el.id.split('.');
        let newX = parseFloat(el.style.left) / el.parentElement.dataset.scale;
        let newY = (el.parentElement.clientHeight - parseFloat(el.style.top) - el.clientHeight) / el.parentElement.dataset.scale;
        let newW = parseFloat(el.style.width) / el.parentElement.dataset.scale;
        let newH = parseFloat(el.style.height) / el.parentElement.dataset.scale;
        let ptr = this.elementPointer(ident[0], ident[1]);
        ptr.position[0] = newX;
        ptr.position[1] = newY;
        ptr.width = newW;
        ptr.height = newH;
        el.dataset.justMoved = true;
        this.elementChanged(el);
    }

    // points into the right thing to change, based on which mode (template edit vs doc edit)
    elementPointer(pgNum, elNum) {
        if (this.activeTemplate != null) {
            return jzinDesigner.templates[this.activeTemplate].document.pages[pgNum].elements[elNum];
        } else {
            return this.doc.document.pages[pgNum].elements[elNum];
        }
    }

    elementChanged(el) {
        let ident = el.id.split('.');
        console.info('element changed! %d,%d %o', ident[0], ident[1], el);
        if (this.activeTemplate != null) {
            this.doc = this.docFromTemplate(jzinDesigner.templates[this.activeTemplate], jzinDesigner.templateFeed);
            let previewDoc = this.docFromTemplate(jzinDesigner.templates[this.activeTemplate], this.feed.feed);
            this.previewPages(previewDoc);
            this.templateAltered(this.activeTemplate);
        } else {
            console.warn('NEED TO PREVIEW ETC');
        }
    }

    templateAltered(tnum) {
        jzinDesigner.templates[tnum].meta._modified = new Date();
        localStorage.setItem('template' + tnum, JSON.stringify(jzinDesigner.templates[tnum]));
    }

    resetTemplate(tnum) {
        localStorage.removeItem('template' + tnum);
    }

    elementClicked(ev) {
        let el = ev.target.closest('.jzd-element-container');
        if (el.dataset.justMoved) {
            delete el.dataset.justMoved;
            return;
        }
        this.activateElement(el);
        ev.stopPropagation();
    }

    activateElement(el) {
console.log('ACTIVATE ELEMENT el=%o, activeElement=%o', el, this.activeElement);
        if ((el == null) && (this.activeElement == null)) return;
        let els = this.el.getElementsByClassName('jzd-element-active');
        for (let i = 0 ; i < els.length ; i++) {
            els[i].classList.remove('jzd-element-active');
        }
        this.activeElement = el;
        this.setUI(el);
        if (el == null) return;
        el.classList.add('jzd-element-active');
    }

    addElement(containerEl, elData, depth) {
        if (elData.hidden) return;
        let me = this;
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
        let r = 11;
        let cpos = [{top: -r, left: -r}, {top: -r, right: -r}, {bottom: -r, left: -r}, {bottom: -r, right: -r}];
        for (let i = 0 ; i < 4 ; i++) {
            let rc = document.createElement('div');
            rc.setAttribute('class', 'jzd-resize-corners no-drag');
            rc.dataset.corner = i;
            rc.style.cursor = 'nwse-resize';
            if ((i == 1) || (i == 2)) rc.style.cursor = 'nesw-resize';
            for (let pos in cpos[i]) {
                rc.style[pos] = cpos[i][pos];
            }
            rc.addEventListener('mousedown', function(ev) { me.cornerEvent(ev); });
            el.appendChild(rc);
        }
        return el;
    }

    cornerEvent(ev) {
        if (ev.type == 'mousedown') {
            ev.target.parentElement.classList.add('no-drag');
            this.resizePreview = document.createElement('div');
            this.resizePreview.setAttribute('class', 'jzd-resize-preview');
            this.resizePreview.style.top = ev.target.parentElement.style.top;
            this.resizePreview.style.left = ev.target.parentElement.style.left;
            this.resizePreview.style.width = ev.target.parentElement.style.width;
            this.resizePreview.style.height = ev.target.parentElement.style.height;
            this.resizeElement = ev.target.parentElement;

            this.resizePreview.dataset.corner = ev.target.dataset.corner;
/*
            this.resizePreview.dataset.origW = this.resizePreview.style.width;
            this.resizePreview.dataset.origH = this.resizePreview.style.height;
            this.resizePreview.dataset.origTop = this.resizePreview.style.top;
            this.resizePreview.dataset.origLeft = this.resizePreview.style.left;
*/
            this.resizePreview.dataset.downX = ev.clientX;
            this.resizePreview.dataset.downY = ev.clientY;

            this.pageBackdrop.appendChild(this.resizePreview);

            ev.stopPropagation();
            ev.preventDefault();
            return;
        }

        if (!this.resizePreview) return;
        ev.stopPropagation();
        ev.preventDefault();

        if (ev.type == 'mousemove') {
            let cor = parseInt(this.resizePreview.dataset.corner);
            let downX = parseInt(this.resizePreview.dataset.downX);
            let downY = parseInt(this.resizePreview.dataset.downY);
            let dx = ev.clientX - downX;
            let dy = ev.clientY - downY;

            //console.log('RESIZING! [%d] %f %f', cor, dx, dy);
            if (cor == 0) {
                this.resizePreview.style.left = parseInt(this.resizeElement.style.left) + dx + 'px';
                this.resizePreview.style.top = parseInt(this.resizeElement.style.top) + dy + 'px';
                this.resizePreview.style.width = parseInt(this.resizeElement.style.width) - dx + 'px';
                this.resizePreview.style.height = parseInt(this.resizeElement.style.height) - dy + 'px';
            } else if (cor == 1) {
                this.resizePreview.style.top = parseInt(this.resizeElement.style.top) + dy + 'px';
                this.resizePreview.style.height = parseInt(this.resizeElement.style.height) - dy + 'px';
                this.resizePreview.style.width = parseInt(this.resizeElement.style.width) + dx + 'px';
            } else if (cor == 2) {
                this.resizePreview.style.left = parseInt(this.resizeElement.style.left) + dx + 'px';
                this.resizePreview.style.width = parseInt(this.resizeElement.style.width) - dx + 'px';
                this.resizePreview.style.height = parseInt(this.resizeElement.style.height) + dy + 'px';
            } else if (cor == 3) {
                this.resizePreview.style.width = parseInt(this.resizeElement.style.width) + dx + 'px';
                this.resizePreview.style.height = parseInt(this.resizeElement.style.height) + dy + 'px';
            }

        } else if (ev.type == 'mouseup') {
            console.log('RESIZE MOUSEUP!!! on %o', this.resizeElement);
            this.resizeElement.classList.remove('no-drag');
            this.resizeElement.style.left = this.resizePreview.style.left;
            this.resizeElement.style.top = this.resizePreview.style.top;
            this.resizeElement.style.width = this.resizePreview.style.width;
            this.resizeElement.style.height = this.resizePreview.style.height;

            this.resizePreview.remove();
            this.resizePreview = null;
            this.elementResized(this.resizeElement);
            this.resizeElement = null;
        }
    }

    elementContainerSetSize(el, parentEl) {
        if (!parentEl) parentEl = el.parentElement;
        let scale = parentEl.dataset.scale || 1;
        el.style.left = scale * el.dataset.positionX;
        el.style.top = parentEl.clientHeight - scale * (parseFloat(el.dataset.height) + parseFloat(el.dataset.positionY));
        el.style.width = scale * el.dataset.width;
        el.style.height = scale * el.dataset.height;
        if (el.dataset.fontSize) el.style.fontSize = parseFloat(el.dataset.fontSize) * scale;
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
        el.dataset.fontSize = elData.fontSize;
        this.setTextElementStyle(el, elData, scale);
        containerEl.appendChild(el);
        return el;
    }

    setTextElementStyle(el, elData, scale) {
        if (!scale) scale = parseFloat(el.parentElement.dataset.scale) || 1;
        if (elData.options && elData.options.align) el.style.textAlign = elData.options.align;
        if (elData.textType == 'paragraph') {
            if (!elData.overflow) el.style.overflowY = 'hidden';
        } else {
            if (!elData.overflow) {
                // FIXME better to overflowX hidden here, but that makes scrollbar :(
                el.style.overflow = 'hidden';
            }
            el.style.whiteSpace = 'nowrap';
        }
        el.style.fontSize = elData.fontSize * scale;
        if (elData.font) el.style.fontFamily = elData.font;
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

    layout(paperSize, numAcross, numDown, signatureSheets) {
        numAcross = numAcross || 1;
        numDown = numDown || 1;
        signatureSheets = signatureSheets || 0;
        let pageOrder = [];
        let previewDoc = this.docFromTemplate(jzinDesigner.templates[this.activeTemplate], this.feed.feed);
        let numPages = previewDoc.document.pages.length;
        let perSheet = numAcross * numDown * 2;
        let numSheets = Math.ceil(numPages / perSheet);
        if (!signatureSheets) signatureSheets = numSheets;

        let perRowStack = numSheets * numAcross * 2;
console.log('layout numPages=%d perSheet=%d numSheets=%d perRowStack=%d', numPages, perSheet, numSheets, perRowStack);
        let sheetsProcessed = 0;
        while (sheetsProcessed < numSheets) {
            let offset = sheetsProcessed * perSheet;
            for (let sig = 0 ; sig < signatureSheets ; sig++) {
                let sheetInit = offset;
console.log('layout sheetInit = %d', sheetInit);
                for (let side = 0 ; side < 2 ; side++) {
                    for (let y = 0 ; y < numDown ; y++) {
                        for (let x = 0 ; x < numAcross ; x++) {
                            if (x % 2 == 1) {
                                if (side == 0) {
                                    pageOrder.push(sheetInit + x - 1 + y * perRowStack);
                                } else {
                                    pageOrder.push(sheetInit + (signatureSheets - sig) * numAcross * numDown * 2 + x - 1 - numAcross - y * perRowStack);
                                }
                            } else {
                                if (side == 0) {
                                    pageOrder.push(sheetInit + (signatureSheets - sig) * numAcross * numDown * 2 - x + 1 - numAcross - y * perRowStack);
                                } else {
                                    pageOrder.push(sheetInit + (numAcross - 1) - x + y * perRowStack);
                                }
                            }
console.log('>> layout (%d,%d) pushed %s', x, y, pageOrder[pageOrder.length-1]);
                        }
                    }
                }
                sheetsProcessed++;
                offset += numAcross;
pageOrder.push('_');
            }
        }
        return pageOrder;
    }

    print() {
        let previewDoc = this.docFromTemplate(jzinDesigner.templates[this.activeTemplate], this.feed.feed);
        let docJson = JSON.stringify(previewDoc);
        fetch('/mkpdf', { method: 'POST', headers: {'content-type': 'application/json'}, body: docJson })
            .then((response) => response.json())
            .then((data) => console.log(data));
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


