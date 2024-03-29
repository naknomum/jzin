
class jzinDesigner {

    static version = '0.0.9';
    static fonts = null;
    static fontSelect = null;

    static numTemplates = 7;
    static templates = [];

    static resizeTimer = null;

    static templateFeedBase = [
            {
                    "image": "templates/image-placeholder.png",
                    "author": "author {i}",
                    "title": "title {i}",
                    "caption": "caption {i}",
                    "time": "1999-12-31T00:00:00+00:00",
                    "hashtags": [ "hashtag", "tag", "jzin", "item0" ]
            },
            {
                    "image": "templates/image-placeholder.png",
                    "author": "author {i}",
                    "title": "title {i}",
                    "caption": "caption {i}",
                    "time": "1999-12-31T01:01:01+00:00",
                    "hashtags": [ "hashtag", "tag", "jzin", "item1" ]
            }
    ];

    static languageMap = {
        'en-us': {
            'title': 'US English',
            'icon': '🇺🇸'
        },
        'fr': {
            'title': 'Le français',
            'icon': '🇫🇷'
        }
    };

    constructor(el, projId) {
        this.projId = projId;
        this.el = el;
        this.pageBackdrop = null;
        this.pageCurrent = 0;
        if (projId.startsWith('ig-')) {
            this.dataDirUrl = '../assets/ig/' + projId.substring(3);
        } else if (projId.startsWith('rss-')) {
            this.dataDirUrl = '../assets/rss/' + projId.substring(4);
        } else {
            this.dataDirUrl = '../assets/' + projId;
        }
        this.feed = null;
        this.doc = null;
        this.imagesToCache = -1;
        this.imageSizes = {};
        this.activeTemplate = null;
        this.activeElement = null;
        this.init();
        return this;
    }

    init() {
        let me = this;

        jzinDesigner.languages = Object.keys(jzinDesigner.languageMap).sort();
        this.preferences = jzinDesigner.localStorageGet('preferences') || {};
        this.setLanguageFromBrowser();

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

        document.addEventListener('keyup', function(ev) { me.keyUp(ev); });  // some key shortcuts

        if (!this.el.style.position) this.el.style.position = 'relative';
        this.uiEl = document.createElement('div');
        this.uiEl.style.position = 'absolute';
        this.uiEl.style.width = '300px';
        this.uiEl.style.minHeight = '450px';
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

        this.messageEl = document.createElement('div');
        this.messageEl.setAttribute('class', 'jzd-message');
        this.el.appendChild(this.messageEl);

        this.initTemplates();
        this.initFonts();
        this._statusCount = 0;
        this.initStatus();
        //this.initFeed();
        this.initDoc();
    }

    message(msg, level) {
        let cls = 'jzd-message';
        if (level) cls += '-' + level;
        this.messageEl.setAttribute('class', cls);
        this.messageEl.innerHTML = msg;
    }

    togglePreferences() {
        this.prefUI.classList.toggle('jzd-preferences-open');
    }

    updatePreference(key, value) {
        this.preferences[key] = value;
        jzinDesigner.localStorageSet('preferences', this.preferences);
    }

    setLanguageFromBrowser() {
        let guess = this.preferences.language || navigator.language.toLowerCase() || '';
        let lang = null;
        let backup = null;
        for (let i = 0 ; i < jzinDesigner.languages.length ; i++) {
            if (jzinDesigner.languages[i] == guess) {
                lang = jzinDesigner.languages[i];
                console.info('exact language match on %s', lang);
            } else if (guess.substr(0,2) == jzinDesigner.languages[i].substr(0,2)) {
                backup = jzinDesigner.languages[i];
                console.info('backup language match (%s) on %s', guess, backup);
            }
        }
        if (lang) {
            this.language = lang;
        } else if (backup) {
            this.language = backup;
        } else {
            this.language = 'en-us';
        }
        this.updatePreference('language', this.language);
        let me = this;
        this.readLanguageMap(function(data) {
            me.languageMap = data;
            me.updateTemplateFeed();
            me.initUI();
        });
    }

    changeLanguage(lang) {
        if (jzinDesigner.languages.indexOf(lang) < 0) return;
        this.language = lang;
        this.updatePreference('language', lang);
        let me = this;
        this.readLanguageMap(function(data) {
            me.languageMap = data;
            me.updateTemplateFeed();
            document.location.reload();
        });
    }

    readLanguageMap(callback) {
        fetch('lang/' + this.language + '.json')
            .then((resp) => resp.json())
            .then((data) => callback(data));
    }

    updateTemplateFeed() {
        jzinDesigner.templateFeed = jzinDesigner.templateFeedBase;
        for (let i = 0 ; i < jzinDesigner.templateFeed.length ; i++) {
            for (let key of ['author', 'title', 'caption']) {
                jzinDesigner.templateFeed[i][key] = '&lt; ' + this.text('template-feed-' + key, {i: i}) + ' &gt;';
            }
        }
    }

    initTemplates() {
        for (let i = 0 ; i < jzinDesigner.numTemplates ; i++) {
            console.debug('reading template %d', i);
            let local = jzinDesigner.localStorageGet('template.' + i);
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

    initStatus() {
        fetch(this.dataDirUrl + '/status.json')
            .then((resp) => resp.json())
            .then((data) => this.gotStatus(data))
            .catch((error) => {
                if (this.language && this.languageMap) this.message(this.text('waiting for data'));
                console.info('gotStatus[%d]: ERROR %o', this._statusCount, error);
                this._statusCount++;
                let me = this;
                window.setTimeout(function() { me.initStatus(); }, 2170);
            });
    }

    gotStatus(data) {
        console.info('gotStatus[%d]: %o', this._statusCount, data);
        if (data.complete) {
            this.initFeed();
            return;
        }
        let pct = Math.round(data.percent * 100) || '-';
        if (this.language && this.languageMap) this.message(this.text('waiting for data') + ' [' + pct + '%]');
        this._statusCount++;
        let me = this;
        window.setTimeout(function() { me.initStatus(); }, 2170);
    }

    initFeed() {
        fetch(this.dataDirUrl + '/feed.json')
            .then((resp) => resp.json())
            .then((data) => this.gotFeed(data));
    }

    gotFeed(data) {
        console.log('FEED DATA: %o', data);
        this.feed = data;
        this.cacheImages();
    }

    cacheImages() {
        if (!this.imagesToCache) return this.initUI();

        if (this.imagesToCache < 0) {
            let me = this;
            let srcs = [];
            // the placeholder
            srcs.push(jzinDesigner.templateFeedBase[0].image);
            // coverImage
            if (this.feed.meta.coverImage) srcs.push(this.imageSrc(this.feed.meta.coverImage));
            // now the images from feed
console.log('zzzzz %o', srcs);
            for (let i = 0 ; i < this.feed.feed.length ; i++) {
                if (this.feed.feed[i].image) srcs.push(this.imageSrc(this.feed.feed[i].image));
            }
            this.imagesToCache = srcs.length;
            for (let i = 0 ; i < srcs.length ; i++) {
                let img = document.createElement('img');
                img.style.visibility = 'hidden';
                img.style.position = 'absolute';
                img.style.left = 0;
                img.style.top = 0;
                img.style.width = 10;
                img.style.height = 10;
                document.body.appendChild(img);
                let src = srcs[i];
                if (src.indexOf('/') < 0) src = this.dataDirUrl + '/' + src;
                img.addEventListener('load', function(ev) {
                    console.info('image cache[%d]: %s %o (%o,%o)', me.imagesToCache, this.src, this.complete, this.naturalWidth, this.naturalHeight);
                    me.imageSizes[srcs[i]] = [this.naturalWidth, this.naturalHeight];
                    me.imagesToCache--;
                    me.message(me.text('waiting for images') + ' [' + me.imagesToCache + ']');
                    me.cacheImages();  // will allow us to exit when done
                });
                img.src = src;
            }
        }
    }

    // TODO: resolve how to fetch remove vs local
    initDoc() {
        //this.gotDoc({});
        //return;
        let loc = jzinDesigner.localStorageGet('doc.' + this.projId);
        if (loc) {
            console.info('using local doc: %s', this.projId);
            this.gotDoc(loc);
            return;
        }
        this.doc = {}; return;
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
        console.debug('template %d: %s', i, tdata.meta.title['en-us']);
        jzinDesigner.templates[i] = tdata;
        this.initUI();
    }

    text(str, sub) {
        sub = sub || {};
        str = this.languageMap[str] || str;
        const regex = /{(\w+)}/;
        while (regex.test(str)) {
            str = str.replace(regex, sub[RegExp.$1]);
        }
        return str;
    }

    initUI() {
        if (jzinDesigner.templates.length < jzinDesigner.numTemplates) return;
        for (let i = 0 ; i < jzinDesigner.templates.length ; i++) {
            if (!jzinDesigner.templates[i]) return;
        }
        if (!jzinDesigner.fonts) return;
        if (!this.feed) return;
        if (!this.doc) return;
        if (!this.languageMap) return;

        // have everything we need
        this.initPrefs();
        this.setUI();
    }

    initPrefs() {
        let me = this;
        this.prefUI = document.createElement('div');
        this.prefUI.classList.add('jzd-preferences-ui');
        let pbutton = document.createElement('div');
        pbutton.classList.add('jzd-preferences-button');
        pbutton.innerHTML = jzinDesigner.languageMap[this.language].icon + ' ⚙️';
        pbutton.addEventListener('click', function(ev) { me.togglePreferences(ev); });
        this.prefUI.appendChild(pbutton);
        let langMenu = document.createElement('select');
        langMenu.addEventListener('change', function(ev) {
            me.changeLanguage(this.value);
            ev.stopPropagation();
        });
        for (let i = 0 ; i < jzinDesigner.languages.length ; i++) {
            let opt = document.createElement('option');
            let lkey = jzinDesigner.languages[i];
            opt.setAttribute('value', lkey);
            opt.innerHTML = jzinDesigner.languageMap[lkey].icon + ' ' + jzinDesigner.languageMap[lkey].title + ' [' + lkey + ']';
            langMenu.appendChild(opt);
        }
        langMenu.value = this.language;
        this.prefUI.appendChild(langMenu);

        pbutton = document.createElement('button');
        pbutton.style.display = 'block';
        pbutton.style.marginTop = '4em';
        pbutton.innerHTML = '⚠️ ' + this.text('RESET ALL CHANGES') + ' ⚡💀';
        pbutton.addEventListener('click', function(ev) {
            me.resetAllTemplates();
            me.clearLocalStorageDocument();
            window.location.reload();
        });
        this.prefUI.appendChild(pbutton);

        let about = document.createElement('div');
        about.classList.add('jzd-preferences-about');
        about.innerHTML = 'version ' + jzinDesigner.version;
        this.prefUI.appendChild(about);

        this.el.appendChild(this.prefUI);
    }

    inTemplateMode() {
        return (this.activeTemplate != undefined);
    }

    setUI(el) {
        if (!el) {
            if (this.inTemplateMode() || !(this.doc && this.doc.document && this.doc.document.pages)) {
                let templateToUse = 0;
                if (this.preferences.activeTemplate != undefined) templateToUse = this.preferences.activeTemplate;
                if (this.activeTemplate == null) this.chooseTemplate(templateToUse);
                this.initTemplateUI();
                this.message(this.text('Choose a template. Edit the template and change how all pages will look.'));
            } else {
                this.initDocUI();
                let pc = this.pageCurrent;
                this.pageCurrent = null;
                this.pageGo(pc);
                this.previewPages(this.doc);
                this.previewActivate(pc);
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
        let me = this;
        this.uiEl.innerHTML = '';
        let title = document.createElement('div');
        title.setAttribute('class', 'jzd-ui-section-title');
        title.innerHTML = this.text('Image Properties');
        this.uiEl.append(title);

        this.uiEl.appendChild(document.createElement('hr'));
        title = document.createElement('div');
        title.setAttribute('class', 'jzd-ui-subtitle');
        title.innerHTML = '⚠️  '  +this.text('NOT YET IMPLEMENTED');
        this.uiEl.append(title);

        let tmp = document.createElement('div');
        tmp.innerHTML = '<img src="ui-images/image-inside.png"/> ' + this.text('Fit inside');
        this.uiEl.append(tmp);
        tmp = document.createElement('div');
        tmp.innerHTML = '<img src="ui-images/image-outside.png"/> ' + this.text('Fit outside');
        this.uiEl.append(tmp);
        tmp = document.createElement('div');
        tmp.innerHTML = '<img src="ui-images/image-outside-crop.png"/> ' + this.text('Fit outside, cropped');
        this.uiEl.append(tmp);

        if (this.inTemplateMode()) return;
        this.uiEl.appendChild(document.createElement('hr'));
        let del = document.createElement('button');
        del.innerHTML = this.text('Delete');
        del.addEventListener('click', function(ev) {
            me.deleteElement(pgNum, elNum);
            me.repaginate();
            me.docAltered();
            me.refreshAndGo(pgNum);
            ev.stopPropagation();
        });
        this.uiEl.appendChild(del);
    }

    setUIText(el, elData, pgNum, elNum) {
        this.uiEl.innerHTML = '';
        let fsel = jzinDesigner.fontSelect.cloneNode(true);
        for (let opt of fsel.options) {
            if (opt.value == elData.font) opt.selected = true;
        }
        let me = this;
        let scale = parseFloat(el.parentElement.dataset.scale);

        let title = document.createElement('div');
        title.setAttribute('class', 'jzd-ui-section-title');
        title.innerHTML = this.text('Font and size');
        this.uiEl.append(title);
        fsel.addEventListener('change', function(ev) {
            let ptr = me.elementPointer(pgNum, elNum);
            ptr.font = ev.target.value;
            me.setTextElementStyle(el, ptr);
            me.elementChanged(el);
        });
        this.uiEl.appendChild(fsel);

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

        this.uiEl.appendChild(document.createElement('hr'));

        title = document.createElement('div');
        title.setAttribute('class', 'jzd-ui-section-title');
        title.innerHTML = this.text('Alignment and wrapping');
        this.uiEl.append(title);
        let asel = document.createElement('select');
        let aligns = ['left', 'center', 'right'];
        for (let i = 0 ; i < aligns.length ; i++) {
            let opt = document.createElement('option');
            opt.setAttribute('value', aligns[i]);
            opt.innerHTML = this.text(aligns[i]);
            asel.appendChild(opt);
        }
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

        let pcheck = document.createElement('input');
        pcheck.setAttribute('type', 'checkbox');
        pcheck.setAttribute('id', 'text-paragraph-wrap');
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
        let label = document.createElement('label');
        label.setAttribute('for', 'text-paragraph-wrap');
        label.innerHTML = this.text('Wrap paragraph');
        this.uiEl.appendChild(label);

        let ocheck = document.createElement('input');
        ocheck.setAttribute('type', 'checkbox');
        ocheck.setAttribute('id', 'text-overflow');
        if (elData.overflow) ocheck.setAttribute('checked', null);
        ocheck.addEventListener('change', function(ev) {
            let ptr = me.elementPointer(pgNum, elNum);
            ptr.overflow = ev.target.checked;
            me.setTextElementStyle(el, ptr);
            me.elementChanged(el);
        });
        this.uiEl.appendChild(ocheck);
        label = document.createElement('label');
        label.setAttribute('for', 'text-overflow');
        label.innerHTML = this.text('Show overflow');
        this.uiEl.appendChild(label);

        if (this.inTemplateMode()) return;
        this.uiEl.appendChild(document.createElement('hr'));
        let del = document.createElement('button');
        del.innerHTML = this.text('Delete');
        del.addEventListener('click', function(ev) {
            me.deleteElement(pgNum, elNum);
            me.repaginate();
            me.docAltered();
            me.refreshAndGo(pgNum);
            ev.stopPropagation();
        });
        this.uiEl.appendChild(del);
    }

    initTemplateUI() {
        this.el.classList.add('jzd-mode-template');
        this.el.classList.remove('jzd-mode-document');
        this.uiEl.innerHTML = '';
        let title = document.createElement('div');
        title.setAttribute('class', 'jzd-ui-section-title');
        title.innerHTML = this.text('Choose and Edit Template');
        this.uiEl.appendChild(title);
        let tsel = document.createElement('select');
        for (let i = 0 ; i < jzinDesigner.templates.length ; i++) {
            let topt = document.createElement('option');
            if (i == this.activeTemplate) topt.setAttribute('selected', '');
            topt.setAttribute('value', i);
            let tname = jzinDesigner.templates[i].meta.title[this.language] || jzinDesigner.templates[i].meta.title['en-us'];
            if (jzinDesigner.templates[i].meta._modified) tname += ' &#9733;';
            topt.innerHTML = tname;
            tsel.appendChild(topt);
        }
        this.uiEl.appendChild(tsel);
        this.uiEl.appendChild(document.createElement('hr'));

        title = document.createElement('div');
        title.setAttribute('class', 'jzd-ui-section-title');
        title.innerHTML = this.text('Pages in template');
        this.uiEl.appendChild(title);
        let me = this;
        tsel.addEventListener('change', function(ev) { me.chooseTemplate(parseInt(ev.target.value)) });
        this.uiEl.style.zIndex = 1000;
        this.uiEl.style.overflow = 'hidden';
        let bwrapper = document.createElement('div');
        bwrapper.style.padding = '4px';
        bwrapper.classList.add('jzd-template-pager', 'jzd-template-pager-one');
        let b = document.createElement('button');
        b.innerHTML = '&#8592;';
        b.addEventListener('click', function(ev) { me.pageChange(-1); });
        bwrapper.appendChild(b);
        b = document.createElement('div');
        b.style.margin = '0 8px';
        b.style.display = 'inline-block';
        b.innerHTML = this.text('Viewing') + ' ' + '<span class="jzd-page-current">-</span>';
        bwrapper.appendChild(b);
        b = document.createElement('button');
        b.innerHTML = '&#8594;';
        b.addEventListener('click', function(ev) { me.pageChange(1); });
        bwrapper.appendChild(b);
        this.uiEl.appendChild(bwrapper);
        this.uiEl.appendChild(document.createElement('hr'));

        this.setPageDisplay(this.pageCurrent || 0);
        b = document.createElement('button');
        b.innerHTML = this.text('Create Document from Template');
        b.addEventListener('click', function(ev) { me.createDocFromTemplate(); });
        this.uiEl.appendChild(b);
    }

    initDocUI() {
        this.message(this.text('Now you may edit the document, add special pages, and print.'));
        this.el.classList.add('jzd-mode-document');
        this.el.classList.remove('jzd-mode-template');
        this.uiEl.innerHTML = '';
        let title = document.createElement('div');
        title.setAttribute('class', 'jzd-ui-section-title');
        title.innerHTML = this.text('Edit Document');
        this.uiEl.appendChild(title);

        title = document.createElement('div');
        title.setAttribute('class', 'jzd-ui-subtitle');
        title.innerHTML = this.text('Editing page') + ' <span class="jzd-page-current">0</span>';
        this.uiEl.appendChild(title);

        let me = this;

        this.uiEl.appendChild(document.createElement('hr'));
        let b = document.createElement('button');
        b.innerHTML = this.text('Add text');
        b.addEventListener('click', function(ev) {
            let pw = me.doc.document.pages[me.pageCurrent].size[2] - me.doc.document.pages[me.pageCurrent].size[0];
            let ph = me.doc.document.pages[me.pageCurrent].size[3] - me.doc.document.pages[me.pageCurrent].size[1];
            let fontSize = me.generalScaleFontSize(18);
            let newEl = {
                elementType: 'text',
                font: me.defaultFont(),
                fontSize: fontSize,
                options: {align: 'left'},
                text: me.text('New text element.'),
                position: [0.2 * pw, 0.8 * ph],
                height: fontSize * 2.5,
                width: pw * 0.6
            };
            me.doc.document.pages[me.pageCurrent].elements.push(newEl);

            let depth = me.doc.document.pages[me.pageCurrent].elements.length - 1;
            let added = me.addElement(me.pageBackdrop, newEl, depth);
            new Draggy(added);
            added.addEventListener('draggy.moved', function(ev) { me.elementMoved(ev); });
            added.addEventListener('click', function(ev) { me.elementClicked(ev); });
            added.id = me.pageCurrent + '.' + depth;

            me.docAltered();
            me.previewPages(me.doc);
            ev.stopPropagation();
        });
        this.uiEl.appendChild(b);
        b = document.createElement('button');
        b.innerHTML = this.text('Add image');
        b.setAttribute('disabled', 'disabled');
        b.setAttribute('title', this.text('NOT YET IMPLEMENTED'));
        b.addEventListener('click', function(ev) {
            ev.stopPropagation();
            return;
            let pw = me.doc.document.pages[me.pageCurrent].size[2] - me.doc.document.pages[me.pageCurrent].size[0];
            let ph = me.doc.document.pages[me.pageCurrent].size[3] - me.doc.document.pages[me.pageCurrent].size[1];
            let imgW = pw * 0.8;
            let newEl = {
                elementType: 'image',
                position: [(pw - imgW) / 2, (ph - imgW) * 0.8],
                height: imgW,
                width: imgW,
                image: 'templates/image-placeholder.png'
            };
            me.doc.document.pages[me.pageCurrent].elements.push(newEl);

            let depth = me.doc.document.pages[me.pageCurrent].elements.length - 1;
            let added = me.addElement(me.pageBackdrop, newEl, depth);
            new Draggy(added);
            added.addEventListener('draggy.moved', function(ev) { me.elementMoved(ev); });
            added.addEventListener('click', function(ev) { me.elementClicked(ev); });
            added.id = me.pageCurrent + '.' + depth;

            me.docAltered();
            me.previewPages(me.doc);
            ev.stopPropagation();
        });
        this.uiEl.appendChild(b);

        this.uiEl.appendChild(document.createElement('hr'));
        b = document.createElement('button');
        b.innerHTML = '&#8593;';
        b.addEventListener('click', function(ev) {
            if (me.pageCurrent < 1) return;
            me.swapPages(me.pageCurrent, me.pageCurrent - 1);
            me.repaginate();
            me.docAltered();
            me.pageCurrent = me.pageCurrent - 1;
            me.refreshAndGo(me.pageCurrent);
            ev.stopPropagation();
        });
        this.uiEl.appendChild(b);
        let m = document.createElement('span');
        m.innerHTML = this.text('Move this page');
        this.uiEl.appendChild(m);
        b = document.createElement('button');
        b.innerHTML = '&#8595;';
        b.addEventListener('click', function(ev) {
            if (me.pageCurrent >= (me.numDocPages() - 1)) return;
            me.swapPages(me.pageCurrent, me.pageCurrent + 1);
            me.repaginate();
            me.docAltered();
            me.pageCurrent = me.pageCurrent + 1;
            me.refreshAndGo(me.pageCurrent);
            ev.stopPropagation();
        });
        this.uiEl.appendChild(b);

        this.uiEl.appendChild(document.createElement('hr'));
        b = document.createElement('button');
        b.innerHTML = this.text('Delete this page');
        //FIXME del chapter page should also delete back and delete TOC and update TOC checkbox
        b.addEventListener('click', function(ev) {
            me.deletePage(me.pageCurrent);
            me.updateRestoreMenu();
            if (me.pageCurrent >= me.numDocPages()) me.pageCurrent = me.numDocPages() - 1;
            me.repaginate();
            me.docAltered();
            me.refreshAndGo(me.pageCurrent);
            ev.stopPropagation();
            me.message(me.text('Page deleted. You may undo this with the restore menu.'), 'warning');
        });
        this.uiEl.appendChild(b);

        let r = document.createElement('select');
        r.addEventListener('change', function(ev) {
            let rpnum = me.restorePage(parseInt(this.value));
            me.updateRestoreMenu();
            me.pageCurrent = rpnum;
            me.repaginate();
            me.docAltered();
            me.refreshAndGo(me.pageCurrent);
            ev.stopPropagation();
        });
        this._restoreMenu = r;
        this.uiEl.appendChild(r);
        this.updateRestoreMenu();

        this.uiEl.appendChild(document.createElement('hr'));
        title = document.createElement('div');
        title.setAttribute('class', 'jzd-ui-subtitle');
        title.innerHTML = this.text('Document operations');
        this.uiEl.appendChild(title);


        let pgs = this.pagesByType('cover-', true).reverse();
        let pcheck = document.createElement('input');
        pcheck.setAttribute('type', 'checkbox');
        pcheck.setAttribute('id', 'toggle-cover-pages');
        if (pgs.length) pcheck.setAttribute('checked', 'checked');
        pcheck.addEventListener('change', function(ev) {
            let pgs = me.pagesByType('cover-', true).reverse();
            // this is reversed, so we can safely delete without messing up cuz of order
            if (pgs.length) {
                for (let i = 0 ; i < pgs.length ; i++) {
                    me.deletePage(pgs[i]);
                }
            } else {
                me.insertCoverPages();
            }
            me.repaginate();
            me.docAltered();
            me.refreshAndGo(0);
            ev.stopPropagation();
        });
        this.uiEl.appendChild(pcheck);
        let label = document.createElement('label');
        label.setAttribute('for', 'toggle-cover-pages');
        label.innerHTML = this.text('Cover pages');
        this.uiEl.appendChild(label);

        pgs = this.pagesByType('toc', true).reverse();
        pcheck = document.createElement('input');
        pcheck.setAttribute('type', 'checkbox');
        pcheck.setAttribute('id', 'toggle-toc-pages');
        if (pgs.length) pcheck.setAttribute('checked', 'checked');
        let chaps = this.pagesByType('chapter');
        if (!chaps.length) {
            pcheck.setAttribute('disabled', 'disabled');
            pcheck.setAttribute('title', this.text('Needs chapter pages'));
        }
        pcheck.addEventListener('change', function(ev) {
            let pgs = me.pagesByType('toc', true).reverse();
            // this is reversed, so we can safely delete without messing up cuz of order
            let goPnum = 0;
            if (pgs.length) {
                goPnum = pgs[0];
                for (let i = 0 ; i < pgs.length ; i++) {
                    me.deletePage(pgs[i]);
                }
            } else {
                goPnum = me.insertTOCPages();
            }
            me.repaginate();
            me.docAltered();
            me.refreshAndGo(goPnum);
            ev.stopPropagation();
        });
        this.uiEl.appendChild(pcheck);
        label = document.createElement('label');
        label.setAttribute('for', 'toggle-toc-pages');
        label.innerHTML = this.text('Table of contents');
        this.uiEl.appendChild(label);

        pgs = this.pagesByType('index').reverse();
        pcheck = document.createElement('input');
        pcheck.setAttribute('type', 'checkbox');
        pcheck.setAttribute('id', 'toggle-index-pages');
        if (pgs.length) pcheck.setAttribute('checked', 'checked');
        pcheck.addEventListener('change', function(ev) {
            let pgs = me.pagesByType('index').reverse();
            let goPnum = 0;
            // this is reversed, so we can safely delete without messing up cuz of order
            if (pgs.length) {
                for (let i = 0 ; i < pgs.length ; i++) {
                    me.deletePage(pgs[i]);
                }
                goPnum = me.numDocPages();
            } else {
                goPnum = me.insertIndexPages();
            }
            me.repaginate();
            me.docAltered();
            me.refreshAndGo(goPnum);
            ev.stopPropagation();
        });
        this.uiEl.appendChild(pcheck);
        label = document.createElement('label');
        label.setAttribute('for', 'toggle-index-pages');
        label.innerHTML = this.text('Index page(s)');
        this.uiEl.appendChild(label);

        pgs = this.pagesByType('index').reverse();
        pcheck = document.createElement('input');
        pcheck.setAttribute('type', 'checkbox');
        pcheck.setAttribute('id', 'toggle-page-numbers');
        if (me.showPageNumbers) pcheck.setAttribute('checked', 'checked');
        pcheck.addEventListener('change', function(ev) {
            me.showPageNumbers = !me.showPageNumbers;
            if (!me.showPageNumbers) me.removePageNumbers();  // only need to do this when changed
            me.repaginate();
            me.docAltered();
            me.refreshAndGo(me.offsetTOC());
            ev.stopPropagation();
        });
        this.uiEl.appendChild(pcheck);
        label = document.createElement('label');
        label.setAttribute('for', 'toggle-page-numbers');
        label.innerHTML = this.text('Page numbers');
        this.uiEl.appendChild(label);

        this.uiEl.appendChild(document.createElement('hr'));
        r = document.createElement('select');
        r.innerHTML = '<option value="0">' + this.text('Insert before this page') + '</option>' +
            '<option value="1">' + this.text('Insert after this page') + '</option>';
        r.classList.add('jzd-insert-before-after');
        this.uiEl.appendChild(r);

        b = document.createElement('button');
        b.innerHTML = this.text('Insert blank page');
        b.addEventListener('click', function(ev) {
            let delta = parseInt(me.uiEl.getElementsByClassName('jzd-insert-before-after')[0].value);
            me.insertBlankPage(me.pageCurrent + delta);
            me.repaginate();
            me.docAltered();
            me.refreshAndGo(me.pageCurrent + delta);
            ev.stopPropagation();
        });
        this.uiEl.appendChild(b);

        b = document.createElement('button');
        b.innerHTML = this.text('Insert chapter page');
        b.addEventListener('click', function(ev) {
            let delta = parseInt(me.uiEl.getElementsByClassName('jzd-insert-before-after')[0].value);
            me.insertChapterPage(me.pageCurrent + delta);
            me.repaginate();
            me.docAltered();
            me.refreshAndGo(me.pageCurrent + delta);
            ev.stopPropagation();
            let el = document.getElementById('toggle-toc-pages');
            if (el) {
                el.removeAttribute('disabled');
                el.removeAttribute('title');
            }
        });
        this.uiEl.appendChild(b);

        this.uiEl.appendChild(document.createElement('hr'));
        let pwrapper = document.createElement('div');
        pwrapper.classList.add('jzd-print-wrapper');
        b = document.createElement('button');
        b.innerHTML = this.text('Print');
        b.addEventListener('click', function(ev) {
            this.parentElement.classList.add('jzd-print-wrapper-wait');
            me.print();
            ev.stopPropagation();
        });
        pwrapper.appendChild(b);
        this.uiEl.appendChild(pwrapper);
        this.updatePrintSignatureUI();
    }

    updatePrintSignatureUI() {
        if (this.inTemplateMode()) return;
        let wrapper = document.getElementsByClassName('jzd-print-wrapper')[0];
        if (!wrapper) return;
        let id = 'jzd-print-signature-size';
        let div = document.getElementById(id);
        let sigMax = this.numDocPages() / 4 - 2;
        if (sigMax > 1) {
            if (!div) {
                div = document.createElement('select');
                div.style.display = 'inline-block';
                div.id = id;
                wrapper.appendChild(div);
            } else {
                div.innerHTML = '';
            }
            for (let i = 0 ; i < sigMax ; i++) {
                let opt = document.createElement('option');
                opt.value = i;
                opt.innerHTML = (i ? i + ' ' + this.text('sheets/signature') : this.text('No signatures'));
                div.appendChild(opt);
            }

        // we dont need pulldown, kill it if it exists
        } else if (div) {
            div.remove();
        }
    }

    createDocFromTemplate() {
        this.doc = this.docFromTemplate(jzinDesigner.templates[this.activeTemplate], this.feed.feed);
        this.repaginate();
        // TODO do we copy template? reference template?  etc
        this.doc.meta._created = new Date();
        this.doc.meta.title = (this.feed.meta && this.feed.meta.title) || this.text('Untitled');
        this.doc.meta.projectId = this.projId;
        this.doc.meta.guidHash = (this.feed.meta && this.feed.meta.guidHash) || this.computeGuidHash();
        this.docAltered();  // will save
        this.previewPages(this.doc);
        this.activeTemplate = null;
        this.initDocUI();
        this.pageCurrent = null;
        this.pageGo(0);
        this.previewActivate(0);
    }


    computeGuidHash() {
        // this.projId  FIXME
        return null;
    }

    url() {
        if (!this.doc.meta.guidHash) return;
        return 'jzin.org/g/' + this.doc.meta.guidHash;
    }

    // this is to allow nudging some values like fontSize for chapter titles, TOC, index, etc.
    //   it is *roughly* 1.0 for half-page (u.s. letter) size layout, and can be tweaked accordingly for bigger/smaller layouts
    generalScale() {
        return (this.doc.document.layout && this.doc.document.layout.generalScale) || 1.0;
    }
    // this uses above, but just kinda rounds it nicely
    generalScaleFontSize(fs) {
        // FIXME we still get stuff like 10.799999999999 cuz js bites me
        return Math.round(this.generalScale() * fs * 10) / 10;
    }

    defaultFont() {
        // FIXME
        return jzinDesigner.fonts[0].name + ' regular';
    }

    newPageSize(pnum) {
        //FIXME what should size use?
        return this.doc.document.pages[pnum || 0].size;
    }

    insertBlankPage(offset) {
        this.doc.document.pages.splice(offset, 0, {
            size: this.newPageSize(offset),
            elements: []
        });
    }

    insertChapterPage(offset) {
        let size = this.newPageSize(offset);
        let fontSize = this.generalScaleFontSize(50);
        this.doc.document.pages.splice(offset, 0, {
            size: size,
            jzdPageType: 'chapter',
            elements: [{
                jzdRefTOC: true,
                elementType: 'text',
                fontSize: fontSize,
                font: this.defaultFont(),
                options: {align: 'center'},
                textType: 'paragraph',
                position: [0, (size[3] - size[1]) * 0.5],
                height: fontSize * 2.5,
                width: size[2] - size[0],
                text: this.text('Chapter Title')
            }]
        },
        {
            size: size,
            jzdPageType: 'chapter-back',
            elements: []
        });
    }

    insertCoverPages() {
        let size = this.newPageSize();
        let fontSize = this.generalScaleFontSize(60);
        let y = 40;
        let textY = (size[3] - size[1]) * 0.6;
        if (this.feed.meta.coverImage) textY = size[3] - size[1] - fontSize * 3;
        this.doc.document.pages.splice(0, 0,
            {
                size: size,
                jzdExcludeFromPagination: true,
                jzdPageType: 'cover-front',
                elements: [{
                    elementType: 'text',
                    fontSize: fontSize,
                    font: this.defaultFont(),
                    options: {align: 'center'},
                    textType: 'paragraph',
                    position: [0, textY],
                    height: fontSize * 2.5,
                    width: size[2] - size[0],
                    text: this.doc.meta.title || this.text('Cover Page')
                }]
            }
        );
        if (this.feed.meta.coverImage) {
            let cimg = this.imageSrc(this.feed.meta.coverImage);
            let iw = size[2] - size[0] - 30;
            let ih = iw / this.imageSizes[cimg][0] * this.imageSizes[cimg][1];
            let covImage = {
                        elementType: 'image',
                        position: [15, textY - ih - 10],
                        height: ih,
                        width: iw,
                        image: this.feed.meta.coverImage
            };
            this.doc.document.pages[0].elements.push(covImage);
        }

        let insideCoverPage = {
            size: size,
            jzdExcludeFromPagination: true,
            jzdPageType: 'cover-front-inside',
            elements: [
                {
                    elementType: 'image',
                    position: [20, y + fontSize],
                    height: 60,
                    width: 60,
                    image: 'qr.png'
                },
                {
                    elementType: 'text',
                    fontSize: fontSize * 0.25,
                    font: this.defaultFont(),
                    position: [25, y],
                    height: fontSize * 0.35,
                    width: (size[3] - size[1]) / 2,
                    text: this.text('Created with: ') + 'jzin.org'
                }
            ]
        };
        let url = this.url();
        if (url) insideCoverPage.elements.splice(1, 0,
            {
                elementType: 'text',
                fontSize: fontSize * 0.3,
                font: this.defaultFont(),
                position: [25, y + fontSize * 0.4],
                height: fontSize * 0.4,
                width: (size[3] - size[1]) / 2,
                text: url
            }
        );
        this.doc.document.pages.splice(1, 0, insideCoverPage);

        this.doc.document.pages.splice(this.doc.document.pages.length, 0,
            {
                size: size,
                jzdExcludeFromPagination: true,
                jzdPageType: 'cover-back-inside',
                elements: []
            },
            {
                size: size,
                jzdExcludeFromPagination: true,
                jzdPageType: 'cover-back',
                elements: []
            }
        );
    }

    insertIndexPages() {
        let offset = this.offsetIndex();
        let fontSize = this.generalScaleFontSize(12);
        this.doc.document.pages.splice(offset, 0, {
            jzdPageType: 'index',
            jzdExcludeFromPagination: true,
            jzdIndexTemplate: {
                font: this.defaultFont(),
                fontSize: fontSize
            },
            size: this.newPageSize(),
            elements: []
        });
        this.repaginate();
        return this.pagesByType('index')[0];
    }

    offsetIndex() {
        let offset = this.numDocPages();
        for (let i = offset - 1 ; i >= 0 ; i--) {
            if (this.doc.document.pages[i].jzdPageType == 'cover-back-inside') offset = i;
        }
        return offset;
    }

    offsetTOC() {
        let offset = 0;
        for (let i = 0 ; i < this.doc.document.pages.length ; i++) {
            if (this.doc.document.pages[i].jzdPageType == 'cover-front-inside') offset = i + 1;
        }
        return offset;
    }

    insertTOCPages() {
        let offset = this.offsetTOC();
        let fontSize = this.generalScaleFontSize(18);
        this.doc.document.pages.splice(offset, 0, {
            jzdPageType: 'toc',
            jzdExcludeFromPagination: true,
            jzdTocTemplate: {
                font: this.defaultFont(),
                fontSize: fontSize
            },
            size: this.newPageSize(),
            elements: []
        }, {
            jzdPageType: 'toc-back',
            jzdExcludeFromPagination: true,
            size: this.newPageSize(),
            elements: []
        });
        this.repaginate();
        return this.pagesByType('toc')[0];
    }

    updateRestoreMenu() {
        this._restoreMenu.innerHTML = '<option>' + this.text('restore deleted pages') + '</option>';
        if (!this.doc._trash || !this.doc._trash.length) return;
        for (let i = 0 ; i < this.doc._trash.length ; i++) {
            if (!this.doc._trash[i].elements) continue;  //not a page
            let opt = document.createElement('option');
            opt.value = i;
            opt.innerHTML = this.doc._trash[i]._delName;
            this._restoreMenu.appendChild(opt);
        }
    }

    restorePage(trashOffset) {
        if (!this.doc._trash || (trashOffset >= this.doc._trash.length) || !this.doc._trash[trashOffet].elements) return;
        let restore = this.doc._trash.splice(trashOffset, 1)[0];
        let target = restore._delPageNum;
        if (target > this.numDocPages()) target = this.numDocPages();
        delete restore._delPageNum;
        delete restore._delName;
        console.info('restoring trashOffset=%d, target=%d: %o', trashOffset, target, restore);
        this.doc.document.pages.splice(target, 0, restore);
        this.message(this.text('The deleted page has been restored.'));
        return target;
    }

    deletePage(pageNum) {
        if ((pageNum < 0) || (pageNum >= this.numDocPages())) return;
        if (!this.doc._trash) this.doc._trash = [];
        let del = this.doc.document.pages.splice(pageNum, 1)[0];
        del._delName = this.text('page') + ' ' + pageNum + (del.jzdPageType ? ' [' + del.jzdPageType + ']' : '');
        del._delPageNum = pageNum;
        this.doc._trash.push(del);
    }

    deleteElement(pageNum, elNum) {
        if ((pageNum < 0) || (pageNum >= this.numDocPages())) return;
        if ((elNum < 0) || !this.doc.document.pages[pageNum].elements || (elNum >= this.doc.document.pages[pageNum].elements.length)) return;
        if (!this.doc._trash) this.doc._trash = [];
        let del = this.doc.document.pages[pageNum].elements.splice(elNum, 1)[0];
        del._delPageNum = pageNum;
        del._delElementNum = elNum;
        this.doc._trash.push(del);
    }

    // just does the work, but no display change, docAltered(), or repagination etc
    undoInternal() {
        if (!this.doc._trash || !this.doc._trash.length) return;
        let obj = this.doc._trash.pop();
        let target = obj._delPageNum;
        delete obj._delPageNum;
        if (obj.elements) {  // restore a page
            if (target > this.numDocPages()) target = this.numDocPages();
            delete obj._delName;
            this.doc.document.pages.splice(target, 0, obj);
            this.message(this.text('The deleted page has been restored.'));
            return {pageNum: target};
        }

        let elTarget = obj._delElementNum;
        delete obj._delElementNum;
        if (target > this.numDocPages()) {
            console.warn('page gone for undo target=%d for element=%o', target, obj);
            return;
        }
        if (elTarget > this.doc.document.pages[target].elements.length) elTarget = this.doc.document.pages[target].elements.length;
        this.doc.document.pages[target].elements.splice(elTarget, 0, obj);
        return {pageNum: target, elementNum: elTarget};
    }

    // does display stuff too (if applicable)
    undo() {
        let restored = this.undoInternal();
        if (!restored) return;
        this.repaginate();
        this.docAltered();
        this.refreshAndGo(restored.pageNum);
        if (restored.elementNum || (restored.elementNum == 0)) {
            let el = this.getDisplayedElement(restored.elementNum);
            if (el) this.activateElement(el);
        }
        return restored;
    }

    swapPages(a, b) {
        if ((a < 0) || (b < 0) || (a == b) || (a >= this.numDocPages()) || (b >= this.numDocPages())) return;
        let tmp = jzinDesigner.cloneObject(this.doc.document.pages[a]);
        this.doc.document.pages[a] = jzinDesigner.cloneObject(this.doc.document.pages[b]);
        this.doc.document.pages[b] = tmp;
    }

    //this will do all the things necessary on the document when pages (ordering, etc) changes
    repaginate() {
        this.removePaddingPages();
        this.reTOC();
        this.reIndex();
        this.rePageNumber();
        this.addPaddingPages();
        this.updatePrintSignatureUI();
    }

    reIndex() {
        let indexTemplate = null;
        let pageSize = null;
        let i = this.doc.document.pages.length;
        //iterate backwards so removing index pages wont break things
        while (i--) {
            if (this.doc.document.pages[i].jzdPageType == 'index') {
                indexTemplate = this.doc.document.pages[i].jzdIndexTemplate;
                pageSize = this.doc.document.pages[i].size;
                this.doc.document.pages.splice(i, 1);
            }
        }
        if (!indexTemplate) return;  // never added index

        let templatePage = {
            jzdPageType: 'index',
            jzdExcludeFromPagination: true,
            jzdIndexTemplate: indexTemplate,
            size: pageSize,
            elements: []
        };

        let pgNum = 0;  //will be 1-indexed (human-readable)
        let index = {};
        for (let i = 0 ; i < this.doc.document.pages.length ; i++) {
            if (this.doc.document.pages[i].jzdExcludeFromPagination) continue;
            pgNum++;
            if (this.doc.document.pages[i].jzdHashTags && this.doc.document.pages[i].jzdHashTags.length) {
                for (let j = 0 ; j < this.doc.document.pages[i].jzdHashTags.length ; j++) {
                    let ref = this.doc.document.pages[i].jzdHashTags[j];
                    if (index[ref] && (index[ref].indexOf(pgNum) > -1)) continue; //already indexed on this page
                    if (!index[ref]) index[ref] = [];
                    index[ref].push(pgNum);
                }
            }
            for (let el = 0 ; el < this.doc.document.pages[i].elements.length ; el++) {
                let ref = this.doc.document.pages[i].elements[el].jzdRefIndex;
                if (!ref) continue;
                if (ref === true) ref = this.doc.document.pages[i].elements[el].text;
                if (!ref) continue;
                let refs = ref.split('|');
                for (let j = 0 ; j < refs.length ; j++) {
                    if (index[refs[j]] && (index[refs[j]].indexOf(pgNum) > -1)) continue; //already indexed on this page
                    if (!index[refs[j]]) index[refs[j]] = [];
                    index[refs[j]].push(pgNum);
                }
            }
        }
        let offset = this.offsetIndex();
        let words = Object.keys(index);
        if (!words.length) {  // none to build, but we still want our placeholder page
            this.doc.document.pages.splice(offset, 0, templatePage);
            return;
        }

        let font = indexTemplate.font || this.defaultFont();
        let fontSize = indexTemplate.fontSize || 10;
        let indent = 20;
        let lineHeight = fontSize * 1.3;
        let y = (templatePage.size[3] - templatePage.size[1]) - lineHeight - indent;

        this.doc.meta.keywords = [];
        words.sort(function(a,b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
        let wn = 0;
let safety = 0;
        while (wn < words.length) {
            let ipage = jzinDesigner.cloneObject(templatePage);
console.log('fooooo y = %o', y);
safety++; if (safety > 1000) fooooobar();
            while (y > 0) {
console.log('wn = %o, y = %o lineHeight=%o, words.length=%o', wn, y, lineHeight, words.length);
safety++; if (safety > 1000) fooooobar();
                this.doc.meta.keywords.push(words[wn]);
                let wordSize = jzinDesigner.textSize(words[wn], font, fontSize);
                ipage.elements.push({
                    elementType: 'text',
                    font: font,
                    fontSize: fontSize,
                    options: {align: 'left'},
                    text: words[wn],
                    position: [indent, y],
                    height: lineHeight,
                    width: wordSize[0] + 10
                    //width: (templatePage.size[2] - templatePage.size[0]) - 2 * indent
                });
                let pageNumbers = index[words[wn]].slice();  // there should be an array operator called spice() just to make it totally confusing
                let maxPerLine = 10;  // yeah kinda arbitrary
                while (pageNumbers.length) {
console.log('pageNumbers = %o', pageNumbers);
                    let theseNumbers = pageNumbers.splice(0, maxPerLine);
                    let pnText = theseNumbers.join(', ');
                    let pnSize = jzinDesigner.textSize(pnText, font, fontSize);
                    ipage.elements.push({
                        elementType: 'text',
                        font: font,
                        fontSize: fontSize,
                        options: {align: 'right'},
                        text: pnText,
                        height: lineHeight,
                        position: [templatePage.size[2] - templatePage.size[0] - 2 * indent - pnSize[0] + 10, y],
                        width: pnSize[0] + 10
                    });
                    y -= lineHeight;
                    maxPerLine = 18;  // we can up this for 2nd+ line
                }
                wn++;
                if (wn >= words.length) y = -1;
            }
            this.doc.document.pages.splice(offset, 0, ipage);
            offset += 1;
            y = (templatePage.size[3] - templatePage.size[1]) - lineHeight - indent;  //reset to top
        }

        this.docAltered();
        return index;
    }

    reTOC() {
        let tocTemplate = null;
        let pageSize = null;
        let i = this.doc.document.pages.length;
        //iterate backwards so removing index pages wont break things
        while (i--) {
            if (this.doc.document.pages[i].jzdPageType == 'toc') {
                tocTemplate = this.doc.document.pages[i].jzdTocTemplate;
                pageSize = this.doc.document.pages[i].size;
                this.doc.document.pages.splice(i, 1);
            }
        }
        if (!tocTemplate) return;  // never added index

        let templatePage = {
            jzdPageType: 'toc',
            jzdExcludeFromPagination: true,
            jzdTocTemplate: tocTemplate,
            size: pageSize,
            elements: []
        };

        let pgNum = 0;  //will be 1-indexed (human-readable)
        let toc = [];
        for (let i = 0 ; i < this.doc.document.pages.length ; i++) {
            if (this.doc.document.pages[i].jzdExcludeFromPagination) continue;
            pgNum++;
            for (let el = 0 ; el < this.doc.document.pages[i].elements.length ; el++) {
                let ref = this.doc.document.pages[i].elements[el].jzdRefTOC;
                if (!ref) continue;
                if (ref === true) ref = this.doc.document.pages[i].elements[el].text;
                toc.push([ref, pgNum]);
            }
        }
        let offset = this.offsetTOC();
        if (!toc.length) {  //nothing to create, but keep placeholder
            this.doc.document.pages.splice(offset, 0, templatePage);
            return;
        }

        //FIXME constrain to one page ... i guess?
        let font = tocTemplate.font || this.defaultFont();
        let fontSize = tocTemplate.fontSize || 12;
        let indent = 20;
        let lineHeight = fontSize * 1.3;
        let y = (templatePage.size[3] - templatePage.size[1]) - lineHeight - indent;

        let usable = templatePage.size[2] - templatePage.size[0] - 2 * indent;
        let col = usable * 0.7;
        let tpage = jzinDesigner.cloneObject(templatePage);
        for (let i = 0 ; i < toc.length ; i++) {
            tpage.elements.push({
                elementType: 'text',
                font: font,
                fontSize: fontSize,
                options: {align: 'right'},
                text: toc[i][0],
                position: [indent, y],
                height: lineHeight,
                width: col
            });
            tpage.elements.push({
                elementType: 'text',
                font: font,
                fontSize: fontSize,
                options: {align: 'right'},
                text: toc[i][1],
                position: [col + 2 * indent, y],
                height: lineHeight,
                width: fontSize * 3
            });
            y -= lineHeight;
        }
        this.doc.document.pages.splice(offset, 0, tpage);

        this.docAltered();
        return toc;
    }

    rePageNumber() {
        if (!this.showPageNumbers) return;
        let size = this.newPageSize();
        let font = this.defaultFont();
        let fontSize = this.generalScaleFontSize(15);
        let indent = 5;

        let elTemplate = {
            jzdPageNumber: true,
            elementType: 'text',
            font: font,
            fontSize: fontSize,
            position: [indent, indent],
            height: fontSize * 1.1,
            width: (size[2] - size[0]) - 2 * indent
        };

        let pgNum = 0;
        for (let i = 0 ; i < this.doc.document.pages.length ; i++) {
            if (this.doc.document.pages[i].jzdExcludeFromPagination || this.doc.document.pages[i].jzdExcludePageNumber) continue;
            pgNum++;
            let found = false;
            let align = ((i % 2 == 0) ? 'right' : 'left');
            // this allows for changing multiple if such a thing would ever be needed?
            for (let j = 0 ; j < this.doc.document.pages[i].elements.length ; j++) {
                if (this.doc.document.pages[i].elements[j].jzdPageNumber) {
                    this.doc.document.pages[i].elements[j].text = pgNum;
                    this.doc.document.pages[i].elements[j].options = {align: align};
                    found = i;
                }
            }
            if (!found) {
                let p = jzinDesigner.cloneObject(elTemplate);
                p.text = pgNum;
                p.options = {align: align};
                this.doc.document.pages[i].elements.push(p);
            }
        }
        this.docAltered();
    }

    removePageNumbers() {
        for (let i = 0 ; i < this.doc.document.pages.length ; i++) {
            // backwards for magic
            for (let j = this.doc.document.pages[i].elements.length - 1 ; j >= 0 ; j--) {
                if (this.doc.document.pages[i].elements[j].jzdPageNumber) this.doc.document.pages[i].elements.splice(j, 1);
            }
        }
    }

    refreshAndGo(pnum) {
        this.previewPages(this.doc);
        this.previewScrollTo(pnum);
        this.pageCurrent = null;
        this.pageGo(pnum);
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
        if (this.activeTemplate == null) return this.numDocPages() - 1;
        return jzinDesigner.templates[this.activeTemplate].document.pages.length - 1;
    }

    pageGo(pnum) {
        pnum = parseInt(pnum);
        if (pnum >= this.numDocPages()) pnum = this.numDocPages() - 1;
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
        this.updatePreference('activeTemplate', tnum);
        this.doc = this.docFromTemplate(jzinDesigner.templates[tnum], jzinDesigner.templateFeed);
        this.resetPageBackdrop();
        this.pageCurrent = 0;
        this.setPageDisplay(0);
        this.displayPage(0, this.pageBackdrop, this.doc, true);

        let previewDoc = this.docFromTemplate(jzinDesigner.templates[tnum], this.feed.feed);
        this.previewPages(previewDoc);
        let els = this.uiEl.getElementsByClassName('jzd-template-pager');
        if (els && els[0]) {
            if (this.pageMax() > 0) {
                els[0].classList.remove('jzd-template-pager-one');
            } else {
                els[0].classList.add('jzd-template-pager-one');
            }
        }
    }

    previewPages(doc) {
        this.previewWrapper.innerHTML = '';
        let me = this;
        for (let i = 0 ; i < doc.document.pages.length ; i++) {
            let el = document.createElement('div');
            el.setAttribute('class', 'jzd-page-preview jzd-page-preview-' + i);
            el.dataset.pagenum = i;
            el.addEventListener('click', function(ev) {
                ev.stopPropagation();
                if (me.activeTemplate !== null) return;
                me.pageGo(this.dataset.pagenum);
                me.previewActivate(this.dataset.pagenum);
            });
            el.title = 'P.' + i;
            this.previewWrapper.appendChild(el);
            el.style.height = el.clientWidth + 'px';
            this.displayPage(i, el, doc);
        }
    }

    previewScrollTo(pageNum) {
        let pgEl = document.getElementsByClassName('jzd-page-preview-' + pageNum)[0];
        if (!pgEl) return;
        let pvw = document.getElementsByClassName('jzd-page-preview-wrapper')[0];
        pvw.scrollTo(0, pgEl.offsetTop);
        this.previewActivate(pageNum);
    }

    previewActivate(pageNum) {
        let pgEl = document.getElementsByClassName('jzd-page-preview-' + pageNum)[0];
        if (!pgEl) return;
        let pvw = document.getElementsByClassName('jzd-page-preview-wrapper')[0];
        let oldCur = pvw.getElementsByClassName('jzd-page-preview-current');
        for (let i = 0 ; i < oldCur.length ; i++) {
            oldCur[i].classList.remove('jzd-page-preview-current');
        }
        pgEl.classList.add('jzd-page-preview-current');
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
                newPage.jzdHashTags = [];
                for (let i = 0 ; i < newPage.elements.length ; i++) {
                    let field = newPage.elements[i].field;
                    if (field == 'title') newPage.elements[i].jzdRefIndex = true;  //auto-index titles
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
                    if (i == 0) newPage.jzdHashTags = newPage.jzdHashTags.concat(feed[offset].hashtags || []);
                    newPage.elements[i][elType] = feed[offset][field] || null;
                    if (elType == 'image') this.fitImage(newPage.elements[i], feed[offset]);
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

        let pgw = doc.document.pages[pnum].size[2] - doc.document.pages[pnum].size[0];
        let pgh = doc.document.pages[pnum].size[3] - doc.document.pages[pnum].size[1];
        this.setScale(containerEl, pgw, pgh);

        let numMajorElements = 0;
        for (let i = 0 ; i < doc.document.pages[pnum].elements.length ; i++) {
            if (!doc.document.pages[pnum].elements[i].jzdPageNumber) numMajorElements++;
        }
        if (!numMajorElements) {
            let type = doc.document.pages[pnum].jzdPageType || null;
            let msg = this.text('this page is blank');
            if (type) msg += '<br />[' + this.text(type) + ']';
            let msgEl = document.createElement('div');
            msgEl.setAttribute('class', 'jzd-blank-page-message');
            msgEl.innerHTML = msg;
            containerEl.appendChild(msgEl);
        }

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
        if (this.inTemplateMode()) {
            return jzinDesigner.templates[this.activeTemplate].document.pages[pgNum].elements[elNum];
        } else {
            return this.doc.document.pages[pgNum].elements[elNum];
        }
    }

    getDisplayedElement(i) {
        let pgEl = document.getElementsByClassName('jzd-page-backdrop')[0];
        if (!pgEl) return;
        return pgEl.children[i];
    }

    elementChanged(el) {
        let ident = el.id.split('.');
        console.info('element changed! %d,%d %o', ident[0], ident[1], el);
        if (this.inTemplateMode()) {
            this.doc = this.docFromTemplate(jzinDesigner.templates[this.activeTemplate], jzinDesigner.templateFeed);
            let previewDoc = this.docFromTemplate(jzinDesigner.templates[this.activeTemplate], this.feed.feed);
            this.previewPages(previewDoc);
            this.templateAltered(this.activeTemplate);
        } else {
            this.repaginate();
            this.previewPages(this.doc);
            this.previewScrollTo(this.pageCurrent);
            this.docAltered();
        }
    }

    numDocPages() {
        return this.doc.document.pages.length;
    }

    templateAltered(tnum) {
        jzinDesigner.templates[tnum].meta._modified = new Date();
        jzinDesigner.localStorageSet('template.' + tnum, jzinDesigner.templates[tnum]);
    }

    docAltered() {
        this.doc.meta._modified = new Date();
        this.save();
    }

    save() {
        if (!this.doc.meta.projectId) return;
        this.doc.meta._saved = new Date();
        console.info('saving %s at %s', this.doc.meta.projectId, this.doc.meta._saved);
        jzinDesigner.localStorageSet('doc.' + this.doc.meta.projectId, this.doc);
        //TODO
        //this.doc.meta._savedRemote = new Date();
        //this.saveRemote()
    }

    resetTemplate(tnum) {
        jzinDesigner.localStorageRemove('template.' + tnum);
    }
    resetAllTemplates() {
        for (let key in localStorage) {
            if (!key.startsWith('template.')) continue;
            jzinDesigner.localStorageRemove(key);
        }
    }
    clearLocalStorageDocument() {
        jzinDesigner.localStorageRemove('doc.' + this.doc.meta.projectId);
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
        this.message(this.text('Alter this element with the different options.'));
        console.log('ACTIVATE ELEMENT el=%o, activeElement=%o', el, this.activeElement);
        if ((el == null) && (this.activeElement == null)) return;
        let els = this.el.getElementsByClassName('jzd-element-active');
        for (let i = 0 ; i < els.length ; i++) {
            els[i].classList.remove('jzd-element-active');
        }
        this.activeElement = el;
        this.setUI(el);
        if (el == null) return;
        let me = this;
        el.classList.add('jzd-element-active');
        if (this.inTemplateMode()) return;
        let ident = el.id.split('.');
        //console.log('activate ???? pg %o', this.doc.document.pages[ident[0]].elements[ident[1]]);
        if ((this.doc.document.pages[ident[0]].elements[ident[1]].elementType == 'text') &&
            !this.doc.document.pages[ident[0]].elements[ident[1]].readOnly) {
            el.setAttribute('contentEditable', 'true');
            //el.addEventListener('input', function(ev) {});
            el.addEventListener('blur', function(ev) {
                // we use innerText here cuz we have the corner divs in here too.  :eyeroll:
                let txt = this.innerText;
                txt = txt.replaceAll('\n', '').replaceAll('\r', '');
                el.innerText = txt;  //FIXME this kills corner divs :(
                if (me.doc.document.pages[ident[0]].elements[ident[1]].text != txt) {
                    me.doc.document.pages[ident[0]].elements[ident[1]].text = txt;
                    me.elementChanged(this);
                }
            });
        }
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
        if (!el) {
            console.warn('no element was added/created for %o', elData);
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

    keyUp(ev) {
        if (ev.code == 'PageDown') {
            this.pageChange(1);
            this.previewActivate(this.pageCurrent);
            ev.stopPropagation();
            ev.preventDefault();
            this.previewScrollTo(this.pageCurrent);
        } else if (ev.code == 'PageUp') {
            this.pageChange(-1);
            this.previewActivate(this.pageCurrent);
            ev.stopPropagation();
            ev.preventDefault();
            this.previewScrollTo(this.pageCurrent);
        } else if (ev.code == 'End') {
            this.pageGo(this.offsetIndex());
            this.previewActivate(this.pageCurrent);
            ev.stopPropagation();
            ev.preventDefault();
            this.previewScrollTo(this.pageCurrent);
        } else if (ev.code == 'Home') {
            this.pageGo(0);
            this.previewActivate(this.pageCurrent);
            ev.stopPropagation();
            ev.preventDefault();
            this.previewScrollTo(this.pageCurrent);
        } else if (ev.code == 'Delete') {
            if (!this.activeElement) return;
            let pe = this.activeElement.id.split('.');
            this.deleteElement(pe[0], pe[1]);
            this.repaginate();
            this.docAltered();
            this.refreshAndGo(pe[0]);
            ev.stopPropagation();
        } else if ((ev.code == 'KeyZ') && ev.ctrlKey) {
            this.undo();
        }
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
        if (!elData.image) return;
        let me = this;
        let el = this.elementContainer(containerEl, elData);
        let img = document.createElement('img');
        img.setAttribute('class', 'jzd-image');
        let src = this.imageSrc(elData.image);
        if (src.indexOf('/') < 0) src = this.dataDirUrl + '/' + src;
        img.src = src;
        el.appendChild(img);
        containerEl.appendChild(el);
        return el;
    }

    imageSrc(elDataImage, srcType) {
        if (!elDataImage) return 'EMPTY';
        if (typeof elDataImage == 'string') return elDataImage;
        if (Array.isArray(elDataImage)) return 'CANNOT HANDLE ARRAYS';
        if (typeof elDataImage != 'object') return 'UNKNOWN elData.image TYPE';
        let src = elDataImage[srcType] || elDataImage.web || elDataImage.original;
        return src;
    }

    // homage to fitInto; adjusts postion and width/height to properly layout image
    fitImage(elData, feedData) {
        let iwh = this.imageSizes[this.imageSrc(elData.image)];
console.log('zzzzz %o %o', iwh, elData.image);
        if (!iwh || !iwh[0] || !iwh[1]) return;
console.log('zzz fitImage el %o', JSON.stringify(elData));
console.log('zzz fitImage feed %o', feedData);
        let xOffset = 0;
        let yOffset = 0;
        let ws = elData.width / iwh[0];
        let hs = elData.height / iwh[1];
        let scale = Math.min(ws, hs);
        if (!elData.fitType || (elData.fitType == 'inside')) {
            xOffset = (elData.width - iwh[0] * scale) / 2;
            yOffset = (elData.height - iwh[1] * scale) / 2;
        }
console.log('zzzz img(%d,%d) el(%d,%d)', iwh[0], iwh[1], elData.width, elData.height);
console.log('zzzz img %o %o %o %o', scale, xOffset, yOffset, elData);
        elData.width = iwh[0] * scale;
        elData.height = iwh[1] * scale;
        elData.position[0] += xOffset;
        elData.position[1] += yOffset;
console.log('zzzz elData is now %s', JSON.stringify(elData));
    }

    addTextElement(containerEl, elData) {
        if (!elData.text) return;
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

    // when *window* is resized
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

    addPaddingPages(multipleOf) {
        //multipleOf = multipleOf || 8;
        //let paddingNeeded = Math.ceil(this.numDocPages() / multipleOf) * multipleOf - this.numDocPages();
        let paddingNeeded = this.numPrintedPages() - this.numDocPages();
        let offset = this.offsetIndex();
//console.log('xxxx offset=%o paddingNeeded=%o', offset, paddingNeeded);
        if (offset > this.numDocPages()) offset = this.numDocPages() - 1;
//console.log('xxxx offset=%o numPages=%o', offset, this.numDocPages());
        for (let i = 0 ; i < paddingNeeded ; i++) {
            this.doc.document.pages.splice(offset, 0, {
                jzdPageType: 'padding',
                jzdExcludeFromPagination: true,
                size: this.newPageSize(),
                elements: []
            });
        }
        if (paddingNeeded) this.docAltered();
        return paddingNeeded;
    }

    removePaddingPages() {
        let removed = 0;
        for (let i = this.numDocPages() - 1 ; i > 0 ; i--) {
            if (this.doc.document.pages[i].jzdPageType == 'padding') {
                this.doc.document.pages.splice(i, 1);
                removed++;
            }
        }
        if (removed) this.docAltered();
        return removed;
    }

    numPrintedPages() {
        let numAcross = this.doc.document.layout.across || 2;
        let numDown = this.doc.document.layout.down || 1;
        let ordData = bookPageOrder(this.numDocPages(), numAcross, numDown);
        return ordData.numPagesActual;
    }

    pagesByType(type, prefix) {
        let matched = [];
        for (let i = 0 ; i < this.doc.document.pages.length ; i++) {
            if (!this.doc.document.pages[i].jzdPageType) continue;
            if ((this.doc.document.pages[i].jzdPageType == type) || (prefix && this.doc.document.pages[i].jzdPageType.startsWith(type))) matched.push(i);
        }
        return matched;
    }

    //kinda debugging only?
    printPreview() {
        this.createPdfDoc();
        this.previewPages(this.pdfDoc);
    }

    //paperSize should be [w,h] in pts
    createPdfDoc(paperSize, numAcross, numDown, signatureSheets, gutter, safeMargin) {
        if (!this.doc.document.layout) this.doc.document.layout = {};
        paperSize = paperSize || this.doc.document.layout.paperSize || [612, 792];
        numAcross = numAcross || this.doc.document.layout.across || 2;
        numDown = numDown || this.doc.document.layout.down || 1;
        signatureSheets = signatureSheets || this.doc.document.layout.signatureSheets || 0;
        gutter = gutter || this.doc.document.layout.gutter || 0;  //FIXME
        safeMargin = safeMargin || this.doc.document.layout.safeMargin || 0;
        console.info(' printing on paper=%o, layout=%dx%d, signature=%d, gutter=%o', paperSize, numAcross, numDown, signatureSheets, gutter);

        let ordData = bookPageOrder(this.numDocPages(), numAcross, numDown, signatureSheets);
console.log('>>>>>> ordData=%o', ordData);
        let pageOrder = ordData.order;
console.log('>>>>>> pageOrder=%o', pageOrder);

        this.pdfDoc = jzinDesigner.cloneObject(this.doc);
        this.pdfDoc.meta.author = 'Unknown JZIN User';  //FIXME
        this.pdfDoc.meta.subject = this.url() + ' [' + this.projId + '] layout: ' + numAcross + 'x' + numDown + ' sigSize: ' + signatureSheets;
        this.pdfDoc.meta.creator = 'jzin.org jzinDesigner ' + jzinDesigner.version;
        this.pdfDoc.document.layout = {paperSize: paperSize};
        this.pdfDoc.document.pages = [];
        let poffset = 0;
        let partW = paperSize[0] / numAcross;
        let partH = paperSize[1] / numDown;
        while (poffset < pageOrder.length) {
            let page = {size: [0, 0, paperSize[0], paperSize[1]], elements: []};
            for (let y = 0 ; y < numDown ; y++) {
                for (let x = 0 ; x < numAcross ; x++) {
                    let pnum = pageOrder[poffset];
                    console.log('>>> (%d,%d) poffset=%d pnum=%d', x, y, poffset, pnum);
                    if (pnum >= this.doc.document.pages.length) {
                        console.info('skipping poffset=%d, x=%d, y=%d, pnum=%d due to no source page', poffset, x, y, pnum);
                        poffset++;
                        continue;
                    }

                    let pw = this.doc.document.pages[pnum].size[2] - this.doc.document.pages[pnum].size[0] + gutter;
                    let ph = this.doc.document.pages[pnum].size[3] - this.doc.document.pages[pnum].size[1];
                    if (pw > partW) console.warn('placed page pw=%d > partW=%d', pw, partW);
                    if (ph > partH) console.warn('placed page ph=%d > partH=%d', ph, partH);

                    let safeScale = 1;
                    if (safeMargin) {
                        let sw = (pw - 2 * safeMargin) / pw;
                        let sh = (ph - 2 * safeMargin) / ph;
                        safeScale = Math.min(sw, sh);
                        console.info('> %dx%d => %f, %f', pw, ph, sw, sh);
                        console.warn('[p%d] safeMargin %f, safeScale %f', poffset, safeMargin, safeScale);
                    }

                    let dx = (partW - pw) / 2;
                    let dy = (partH - ph) / 2;
                    let offsetX = partW * x + dx + gutter * (x % 2) + safeMargin;
                    let offsetY = partH * (numDown - y - 1) + dy + safeMargin;
                    for (let elNum = 0 ; elNum < this.doc.document.pages[pnum].elements.length ; elNum++) {
                        let element = jzinDesigner.cloneObject(this.doc.document.pages[pnum].elements[elNum]);
                        element.position[0] = offsetX + element.position[0] * safeScale;
                        element.position[1] = offsetY + element.position[1] * safeScale;
                        if (safeScale < 1) {  //we adjust any fontSize, width, etc.
                            element.width *= safeScale;
                            element.height *= safeScale;
                            element.fontSize *= safeScale;
                        }
                        page.elements.push(element);
                    }
                    poffset++;
                }
            }
            this.pdfDoc.document.pages.push(page);
        }
        return pageOrder;
    }

    print() {
        let ssEl = document.getElementById('jzd-print-signature-size');
        this.doc.document.layout.signatureSheets = parseInt((ssEl && ssEl.value) || 0);
        this.doc.document.layout.safeMargin = 14;  //who has a full-bleed printer???
        this.createPdfDoc();
        let me = this;
        let errorMsg = this.text('Sorry, there was an error printing.');
        fetch('./app/mkpdf', { method: 'POST', headers: {'content-type': 'text/json; charset=utf-8'}, body: JSON.stringify(this.pdfDoc) })
            .then((response) => response.json())
            .then((data) => {
                console.log('yes!!! %o', data);
                if (data.success) {
                    let link = document.createElement('a');
                    document.body.appendChild(link);
                    link.download = (me.doc.meta.title || 'Untitled') + ' jzin-' + (me.doc.meta.guidHash || '000000') + '.pdf';
                    link.href = data.filename;
                    link.click();
                    link.remove();
                } else {
                    me.message(errorMsg, 'error');
                }
                me.reEnablePrint();
            }).catch((error) => {
                console.error('printing error! %o', error);
                me.message(errorMsg, 'error');
                me.reEnablePrint();
            });
    }

    reEnablePrint() {
        let els = this.uiEl.getElementsByClassName('jzd-print-wrapper-wait');
        if (els && els[0]) els[0].classList.remove('jzd-print-wrapper-wait');
    }

    // this is awful, but gets us there for now
    //  potentially better?   https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript
    static textSize(text, font, fontSize) {
/*
        this.tmpEl.style.fontFamily = font;
        this.tmpEl.style.fontSize = fontSize;
        this.tmpEl.innerHTML = text;
        let wh = [this.tmpEl.offsetWidth, this.tmpEl.offsetHeight];
*/
        let wh = [text.length * fontSize * 0.52, fontSize * 1.2];
        return wh;
    }


    static localStorageGet(key) {
        let ls = localStorage.getItem(key);
        if (!ls) return null;
        return JSON.parse(ls);
    }

    static localStorageSet(key, obj) {
        obj._localStored = new Date();
        localStorage.setItem(key, JSON.stringify(obj));
    }
    static localStorageRemove(key) {
        console.warn('localStorage removing: %s', key);
        localStorage.removeItem(key);
    }

    static cloneObject(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

/*  meh...
    // looks for key=value in any object in tree, returns all objects with match (if any)
    static findObject(obj, key, value) {
        if (typeof obj != 'object') return;   // this also lets thru array, cuz ... js
        if (Array.isArray(obj)) {
        } else {
        }
        return;
    }
*/

    static uuidv4() {  // h/t https://stackoverflow.com/a/2117523
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

}



