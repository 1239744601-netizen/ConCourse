(() => {
  "use strict";

  const STORAGE_PREFIX = "concourse-citation-library-v1";
  const MAX_LIBRARY_ITEMS = 60;
  const STYLE_VALUES = new Set(["apa", "mla", "chicago", "harvard", "ieee"]);
  const SOURCE_VALUES = new Set(["book", "journal", "website"]);

  const COPY = Object.freeze({
    en: Object.freeze({
      toolsWorkspaceTitle:"Citation Studio",
      toolsWorkspaceIntro:"Build a polished reference, check its in-text form, and keep a bibliography for your current project.",
      toolsLocalNote:"Your source details stay in this browser.",
      citationStyleLegend:"Citation style",
      sourceTypeLegend:"Source type",
      sourceBook:"Book",
      sourceJournal:"Journal article",
      sourceWebsite:"Website",
      citationDetailsLegend:"Source details",
      citationAuthorType:"Author entry",
      citationPeople:"Person or people",
      citationOrganisation:"Organisation",
      citationAuthors:"Author(s) or organisation",
      citationAuthorsPlaceholder:"Ng, Ada; Patel, Ravi",
      citationAuthorsHint:"Separate people with semicolons. “Family, Given” is the most reliable name order.",
      citationTitle:"Title",
      citationTitlePlaceholder:"Enter the source title exactly as published",
      citationYear:"Publication year",
      citationYearPlaceholder:"2026 or leave blank for no date",
      citationPublicationDate:"Publication date",
      citationAccessDate:"Date accessed",
      citationPublisher:"Publisher",
      citationPublisherPlaceholder:"Publisher name",
      citationPlace:"Publication place",
      citationPlacePlaceholder:"City, region or country",
      citationEdition:"Edition",
      citationEditionPlaceholder:"2 or 2nd",
      citationJournal:"Journal title",
      citationJournalPlaceholder:"Full journal title",
      citationVolume:"Volume",
      citationIssue:"Issue",
      citationPages:"Pages or article number",
      citationPagesPlaceholder:"115–139 or e2041",
      citationSite:"Website name",
      citationSitePlaceholder:"Website or organisation",
      citationLocator:"DOI or URL",
      citationLocatorPlaceholder:"10.1234/example or https://…",
      citationPinpoint:"Cited page or locator",
      citationPinpointPlaceholder:"42, 115–117, or sec. 3",
      citationClear:"Clear fields",
      citationPreviewEyebrow:"Live output",
      citationPreviewTitle:"Your reference",
      citationReferenceLabel:"Reference-list entry",
      citationInlineLabel:"In-text citation",
      citationNoteLabel:"Short note",
      citationPreviewPlaceholder:"Enter a title to begin generating your reference.",
      citationInlinePlaceholder:"The in-text form will appear here.",
      citationCopy:"Copy reference",
      citationAdd:"Add to bibliography",
      citationReady:"Reference updated.",
      citationCopied:"Reference copied with formatting.",
      citationCopiedPlain:"Reference copied as plain text.",
      citationCopyFailed:"Copying failed. Select the reference and copy it manually.",
      citationAdded:"Added to this project bibliography.",
      citationDuplicate:"This source is already in the bibliography.",
      citationMissingTitle:"Add the source title to generate a reference.",
      citationInvalidYear:"Use a four-digit publication year or leave it blank.",
      citationInvalidUrl:"Use a complete http(s) URL or a DOI beginning with 10.",
      citationBookPublisherWarning:"Add a publisher for a complete book reference.",
      citationJournalWarning:"Add the journal title for a complete article reference.",
      citationWebsiteWarning:"Add a URL for a complete website reference.",
      citationAuthorWarning:"No author was entered; the reference will begin with the title.",
      bibliographyTitle:"Project bibliography",
      bibliographyIntro:"Saved on this device and reformatted whenever you change styles.",
      bibliographyCount:"{count} saved",
      bibliographyCopyAll:"Copy all",
      bibliographyClearAll:"Clear all",
      bibliographyEmpty:"Your saved references will appear here.",
      bibliographyRemove:"Remove",
      bibliographyCopied:"Bibliography copied with formatting.",
      bibliographyCleared:"Bibliography cleared.",
      bibliographyRemoved:"Reference removed.",
      bibliographyStorageFailed:"This browser could not save the bibliography. Check storage settings and try again.",
      bibliographyClearConfirm:"Remove every saved reference from this device?",
      styleCompassTitle:"Choose a style by discipline",
      styleApaUse:"Psychology, education, social sciences and many business courses.",
      styleMlaUse:"Literature, languages, arts and other humanities subjects.",
      styleChicagoUse:"History and publishing; this tool generates a Chicago 17 bibliography entry and short note.",
      styleHarvardUse:"Common across universities and disciplines; local Harvard rules can differ.",
      styleIeeeUse:"Engineering, computer science, electronics and technical research.",
      styleApaAdvice:"APA 7 · Common in social sciences and business. Review sentence case and italicisation before submitting.",
      styleMlaAdvice:"MLA 9 · Common in humanities. Check title capitalisation and your course’s container requirements.",
      styleChicagoAdvice:"Chicago 17 · Notes & Bibliography. Current Chicago 18 guidance differs, so follow your instructor’s required edition.",
      styleHarvardAdvice:"Harvard · This output follows a Cite Them Right–style author-date pattern; universities often publish local variations.",
      styleIeeeAdvice:"IEEE · Common in engineering and computing. References remain in the order you add them.",
      citationDisclaimer:"Generated references are a best-effort starting point. Always check your course, journal, or institution guide before submitting.",
      citationFormattingNote:"Capitalisation rules can depend on language and proper nouns; the generator preserves the title you enter.",
      citationStyleEngine:"Formats included: APA 7, MLA 9, Chicago 17, Harvard author-date and IEEE."
    }),
    "zh-CN": Object.freeze({
      toolsWorkspaceTitle:"引用工作室",
      toolsWorkspaceIntro:"创建规范参考文献、查看文内引用，并为当前项目整理参考书目。",
      toolsLocalNote:"你的文献资料仅保存在此浏览器中。",
      citationStyleLegend:"引用格式",
      sourceTypeLegend:"资料类型",
      sourceBook:"书籍",
      sourceJournal:"期刊文章",
      sourceWebsite:"网页",
      citationDetailsLegend:"资料详情",
      citationAuthorType:"作者输入类型",
      citationPeople:"个人作者",
      citationOrganisation:"机构",
      citationAuthors:"作者或机构",
      citationAuthorsPlaceholder:"Ng, Ada; Patel, Ravi",
      citationAuthorsHint:"个人作者之间用分号分隔；使用“姓, 名”可获得最可靠的姓名顺序。",
      citationTitle:"标题",
      citationTitlePlaceholder:"按出版资料输入完整标题",
      citationYear:"出版年份",
      citationYearPlaceholder:"例如 2026；无日期可留空",
      citationPublicationDate:"发布日期",
      citationAccessDate:"访问日期",
      citationPublisher:"出版社",
      citationPublisherPlaceholder:"出版社名称",
      citationPlace:"出版地点",
      citationPlacePlaceholder:"城市、地区或国家",
      citationEdition:"版本",
      citationEditionPlaceholder:"例如 2 或 2nd",
      citationJournal:"期刊名称",
      citationJournalPlaceholder:"完整期刊名称",
      citationVolume:"卷",
      citationIssue:"期",
      citationPages:"页码或文章编号",
      citationPagesPlaceholder:"115–139 或 e2041",
      citationSite:"网站名称",
      citationSitePlaceholder:"网站或机构",
      citationLocator:"DOI 或网址",
      citationLocatorPlaceholder:"10.1234/example 或 https://…",
      citationPinpoint:"所引页码或定位信息",
      citationPinpointPlaceholder:"42、115–117 或 sec. 3",
      citationClear:"清空字段",
      citationPreviewEyebrow:"实时结果",
      citationPreviewTitle:"你的参考文献",
      citationReferenceLabel:"参考文献条目",
      citationInlineLabel:"文内引用",
      citationNoteLabel:"简短脚注",
      citationPreviewPlaceholder:"输入标题后即可生成参考文献。",
      citationInlinePlaceholder:"文内引用将在这里显示。",
      citationCopy:"复制引用",
      citationAdd:"加入参考书目",
      citationReady:"引用已更新。",
      citationCopied:"已复制带格式的引用。",
      citationCopiedPlain:"已复制纯文本引用。",
      citationCopyFailed:"复制失败，请手动选择并复制引用。",
      citationAdded:"已加入本项目参考书目。",
      citationDuplicate:"该资料已在参考书目中。",
      citationMissingTitle:"请输入资料标题以生成引用。",
      citationInvalidYear:"请输入四位年份，或留空表示无日期。",
      citationInvalidUrl:"请输入完整的 http(s) 网址，或以 10. 开头的 DOI。",
      citationBookPublisherWarning:"请补充出版社以获得完整书籍引用。",
      citationJournalWarning:"请补充期刊名称以获得完整文章引用。",
      citationWebsiteWarning:"请补充网址以获得完整网页引用。",
      citationAuthorWarning:"尚未输入作者；引用将从标题开始。",
      bibliographyTitle:"项目参考书目",
      bibliographyIntro:"保存在此设备；切换格式时会自动重新排版。",
      bibliographyCount:"已保存 {count} 条",
      bibliographyCopyAll:"复制全部",
      bibliographyClearAll:"全部清除",
      bibliographyEmpty:"已保存的参考文献会显示在这里。",
      bibliographyRemove:"移除",
      bibliographyCopied:"已复制带格式的参考书目。",
      bibliographyCleared:"参考书目已清空。",
      bibliographyRemoved:"参考文献已移除。",
      bibliographyStorageFailed:"此浏览器无法保存参考书目，请检查存储设置后重试。",
      bibliographyClearConfirm:"确定移除此设备上的全部参考文献吗？",
      styleCompassTitle:"按学科选择格式",
      styleApaUse:"心理学、教育、社会科学及许多商科课程。",
      styleMlaUse:"文学、语言、艺术及其他人文学科。",
      styleChicagoUse:"历史与出版；本工具生成 Chicago 17 参考书目条目和简短脚注。",
      styleHarvardUse:"广泛用于不同大学和学科；各校 Harvard 规则可能不同。",
      styleIeeeUse:"工程、计算机科学、电子及技术研究。",
      styleApaAdvice:"APA 第 7 版 · 常用于社会科学与商科。提交前请检查句式大小写与斜体。",
      styleMlaAdvice:"MLA 第 9 版 · 常用于人文学科。请检查标题大小写和课程对容器信息的要求。",
      styleChicagoAdvice:"Chicago 第 17 版 · 注释与参考书目体系。Chicago 第 18 版已有更新，请遵循导师要求的版本。",
      styleHarvardAdvice:"Harvard · 采用类似 Cite Them Right 的作者—日期格式；不同大学通常有本校变体。",
      styleIeeeAdvice:"IEEE · 常用于工程与计算机。参考文献按加入顺序编号。",
      citationDisclaimer:"生成结果仅作为可靠起点。提交前请务必核对课程、期刊或学校的格式指南。",
      citationFormattingNote:"标题大小写可能受语言和专有名词影响；生成器会保留你输入的标题。",
      citationStyleEngine:"支持 APA 7、MLA 9、Chicago 17、Harvard 作者—日期及 IEEE。"
    }),
    "zh-HK": Object.freeze({
      toolsWorkspaceTitle:"引用工作室",
      toolsWorkspaceIntro:"建立規範參考文獻、查看文內引用，並為而家嘅項目整理參考書目。",
      toolsLocalNote:"你嘅文獻資料只會儲存喺呢個瀏覽器。",
      citationStyleLegend:"引用格式",
      sourceTypeLegend:"資料類型",
      sourceBook:"書籍",
      sourceJournal:"期刊文章",
      sourceWebsite:"網頁",
      citationDetailsLegend:"資料詳情",
      citationAuthorType:"作者輸入類型",
      citationPeople:"個人作者",
      citationOrganisation:"機構",
      citationAuthors:"作者或機構",
      citationAuthorsPlaceholder:"Ng, Ada; Patel, Ravi",
      citationAuthorsHint:"個人作者之間用分號分隔；用「姓, 名」可以得到最可靠嘅姓名次序。",
      citationTitle:"標題",
      citationTitlePlaceholder:"按照出版資料輸入完整標題",
      citationYear:"出版年份",
      citationYearPlaceholder:"例如 2026；冇日期可以留空",
      citationPublicationDate:"發佈日期",
      citationAccessDate:"查閱日期",
      citationPublisher:"出版社",
      citationPublisherPlaceholder:"出版社名稱",
      citationPlace:"出版地點",
      citationPlacePlaceholder:"城市、地區或國家",
      citationEdition:"版本",
      citationEditionPlaceholder:"例如 2 或 2nd",
      citationJournal:"期刊名稱",
      citationJournalPlaceholder:"完整期刊名稱",
      citationVolume:"卷",
      citationIssue:"期",
      citationPages:"頁碼或文章編號",
      citationPagesPlaceholder:"115–139 或 e2041",
      citationSite:"網站名稱",
      citationSitePlaceholder:"網站或機構",
      citationLocator:"DOI 或網址",
      citationLocatorPlaceholder:"10.1234/example 或 https://…",
      citationPinpoint:"引用頁碼或定位資料",
      citationPinpointPlaceholder:"42、115–117 或 sec. 3",
      citationClear:"清空欄位",
      citationPreviewEyebrow:"即時結果",
      citationPreviewTitle:"你嘅參考文獻",
      citationReferenceLabel:"參考文獻條目",
      citationInlineLabel:"文內引用",
      citationNoteLabel:"簡短註腳",
      citationPreviewPlaceholder:"輸入標題之後就可以產生參考文獻。",
      citationInlinePlaceholder:"文內引用會喺呢度顯示。",
      citationCopy:"複製引用",
      citationAdd:"加入參考書目",
      citationReady:"引用已更新。",
      citationCopied:"已複製帶格式引用。",
      citationCopiedPlain:"已複製純文字引用。",
      citationCopyFailed:"複製失敗，請手動揀選同複製引用。",
      citationAdded:"已加入呢個項目嘅參考書目。",
      citationDuplicate:"呢份資料已經喺參考書目入面。",
      citationMissingTitle:"請輸入資料標題嚟產生引用。",
      citationInvalidYear:"請輸入四位年份，或者留空代表冇日期。",
      citationInvalidUrl:"請輸入完整 http(s) 網址，或者以 10. 開頭嘅 DOI。",
      citationBookPublisherWarning:"請加入出版社以取得完整書籍引用。",
      citationJournalWarning:"請加入期刊名稱以取得完整文章引用。",
      citationWebsiteWarning:"請加入網址以取得完整網頁引用。",
      citationAuthorWarning:"未輸入作者；引用會由標題開始。",
      bibliographyTitle:"項目參考書目",
      bibliographyIntro:"儲存喺呢部裝置；轉換格式時會自動重新排版。",
      bibliographyCount:"已儲存 {count} 條",
      bibliographyCopyAll:"複製全部",
      bibliographyClearAll:"全部清除",
      bibliographyEmpty:"已儲存嘅參考文獻會顯示喺呢度。",
      bibliographyRemove:"移除",
      bibliographyCopied:"已複製帶格式參考書目。",
      bibliographyCleared:"參考書目已清空。",
      bibliographyRemoved:"參考文獻已移除。",
      bibliographyStorageFailed:"呢個瀏覽器未能儲存參考書目，請檢查儲存設定後再試。",
      bibliographyClearConfirm:"確定移除呢部裝置上面嘅全部參考文獻？",
      styleCompassTitle:"按學科選擇格式",
      styleApaUse:"心理學、教育、社會科學同好多商科課程。",
      styleMlaUse:"文學、語言、藝術同其他人文學科。",
      styleChicagoUse:"歷史同出版；呢個工具會產生 Chicago 17 參考書目條目同簡短註腳。",
      styleHarvardUse:"廣泛用於唔同大學同學科；各校 Harvard 規則可能唔同。",
      styleIeeeUse:"工程、電腦科學、電子同技術研究。",
      styleApaAdvice:"APA 第 7 版 · 常用於社會科學同商科。提交之前請檢查句式大小寫同斜體。",
      styleMlaAdvice:"MLA 第 9 版 · 常用於人文學科。請檢查標題大小寫同課程對容器資料嘅要求。",
      styleChicagoAdvice:"Chicago 第 17 版 · 註釋與參考書目體系。Chicago 第 18 版已有更新，請跟從導師要求嘅版本。",
      styleHarvardAdvice:"Harvard · 採用類似 Cite Them Right 嘅作者—日期格式；唔同大學通常有本校變體。",
      styleIeeeAdvice:"IEEE · 常用於工程同電腦。參考文獻按加入次序編號。",
      citationDisclaimer:"產生結果只係可靠起點。提交之前請務必核對課程、期刊或者學校嘅格式指南。",
      citationFormattingNote:"標題大小寫可能受語言同專有名詞影響；產生器會保留你輸入嘅標題。",
      citationStyleEngine:"支援 APA 7、MLA 9、Chicago 17、Harvard 作者—日期同 IEEE。"
    })
  });

  const state = {
    library:[],
    storageKey:"",
    preview:null,
    previewTimer:null,
    initialized:false
  };

  const byId = id => document.getElementById(id);
  const replaceVariables = (value, variables={}) => String(value).replace(/\{(\w+)\}/g, (_match, key) => String(variables[key] ?? ""));
  const language = () => {
    const candidate = typeof currentLanguage === "string" ? currentLanguage : document.documentElement.lang;
    return COPY[candidate] ? candidate : "en";
  };
  const tr = (key, variables={}) => replaceVariables(COPY[language()]?.[key] || COPY.en[key] || key, variables);
  const clean = value => String(value || "").normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  const escapeHtml = value => clean(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
  const stripTerminal = value => clean(value).replace(/[\s.,;:]+$/u, "");
  const sentence = value => {
    const result = clean(value);
    return result ? /[.!?]$/u.test(result) ? result : `${result}.` : "";
  };
  const quoted = (value, single=false) => single ? `‘${stripTerminal(value)}’` : `“${stripTerminal(value)}”`;
  const htmlQuoted = (value, single=false) => single ? `‘${escapeHtml(stripTerminal(value))}’` : `“${escapeHtml(stripTerminal(value))}”`;
  const quotedTerminalPair = (value, terminal=".", single=false) => {
    const title = clean(value);
    const punctuated = /[!?]$/u.test(title) ? title : `${stripTerminal(title)}${terminal}`;
    return pair(single ? `‘${punctuated}’` : `“${punctuated}”`, single ? `‘${escapeHtml(punctuated)}’` : `“${escapeHtml(punctuated)}”`);
  };
  const pair = (plain="", html=null) => ({plain:clean(plain), html:html === null ? escapeHtml(plain) : html});
  const joinWords = (...parts) => parts.flat().map(part => typeof part === "string" ? pair(part) : part).filter(part => part?.plain).reduce((result, part) => ({
    plain:result.plain ? `${result.plain} ${part.plain}` : part.plain,
    html:result.html ? `${result.html} ${part.html}` : part.html
  }), pair());
  const withPeriod = value => {
    const current = typeof value === "string" ? pair(value) : value;
    if(!current?.plain) return pair();
    return {
      plain:/[.!?]$/u.test(current.plain) ? current.plain : `${current.plain}.`,
      html:/[.!?](?:<\/[^>]+>)?$/u.test(current.html) ? current.html : `${current.html}.`
    };
  };

  function parseAuthors(value, mode="auto"){
    const raw = clean(value);
    if(!raw) return [];
    if(mode === "organization") return [{kind:"organization", literal:raw}];
    return raw.split(/[;\n]+/u).map(clean).filter(Boolean).map(token => {
      const comma = token.indexOf(",");
      if(comma > 0){
        const family = clean(token.slice(0, comma));
        const given = clean(token.slice(comma + 1));
        if(family && given) return {kind:"person", family, given};
      }
      if(mode === "person"){
        const names = token.split(/\s+/u).filter(Boolean);
        if(names.length === 1) return {kind:"person", family:names[0], given:""};
        return {kind:"person", family:names.at(-1), given:names.slice(0, -1).join(" ")};
      }
      return {kind:"organization", literal:token};
    });
  }

  function initials(given){
    return clean(given).split(/([\s-]+)/u).map(part => {
      if(/^\s+$/u.test(part) || part === "-") return part;
      const letter = Array.from(part.replace(/^[^\p{L}\p{N}]+/u, ""))[0];
      return letter ? `${letter.toLocaleUpperCase()}.` : "";
    }).join("").replace(/\s+/gu, " ").trim();
  }

  const authorNormal = author => author.kind === "organization" ? author.literal : [author.given, author.family].filter(Boolean).join(" ");
  const authorFamily = author => author.kind === "organization" ? author.literal : author.family;
  const authorInverted = author => author.kind === "organization" ? author.literal : [author.family, author.given].filter(Boolean).join(", ");
  const authorInitialLast = author => author.kind === "organization" ? author.literal : [initials(author.given), author.family].filter(Boolean).join(" ");
  const authorLastInitial = author => author.kind === "organization" ? author.literal : [author.family, initials(author.given)].filter(Boolean).join(", ");

  function serialJoin(values, lastWord="and", oxford=true){
    const items = values.filter(Boolean);
    if(items.length < 2) return items[0] || "";
    if(items.length === 2) return `${items[0]} ${lastWord} ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}${oxford ? "," : ""} ${lastWord} ${items.at(-1)}`;
  }

  function apaAuthors(authors){
    if(!authors.length) return "";
    const formatted = authors.map(authorLastInitial);
    if(formatted.length === 1) return formatted[0];
    if(formatted.length <= 20) return `${formatted.slice(0, -1).join(", ")}, & ${formatted.at(-1)}`;
    return `${formatted.slice(0, 19).join(", ")}, … ${formatted.at(-1)}`;
  }

  function mlaAuthors(authors){
    if(!authors.length) return "";
    if(authors.length === 1) return authorInverted(authors[0]);
    if(authors.length === 2) return `${authorInverted(authors[0])}, and ${authorNormal(authors[1])}`;
    return `${authorInverted(authors[0])}, et al.`;
  }

  function chicagoAuthors(authors){
    if(!authors.length) return "";
    if(authors.length === 2) return `${authorInverted(authors[0])}, and ${authorNormal(authors[1])}`;
    if(authors.length > 10) return `${[authorInverted(authors[0]), ...authors.slice(1, 7).map(authorNormal)].join(", ")}, et al.`;
    return serialJoin([authorInverted(authors[0]), ...authors.slice(1).map(authorNormal)], "and", true);
  }

  function harvardAuthors(authors){
    return serialJoin(authors.map(authorLastInitial), "and", false);
  }

  function ieeeAuthors(authors){
    if(!authors.length) return "";
    if(authors.length > 6) return `${authorInitialLast(authors[0])} et al.`;
    return serialJoin(authors.map(authorInitialLast), "and", true);
  }

  function ordinalEdition(value){
    const raw = clean(value);
    if(!raw || /^(?:1|1st|first)$/iu.test(raw)) return "";
    const match = raw.match(/\d+/u);
    if(!match) return raw.replace(/\s*(?:ed\.?|edition)$/iu, "");
    const number = Number(match[0]);
    const mod100 = number % 100;
    const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : number % 10 === 1 ? "st" : number % 10 === 2 ? "nd" : number % 10 === 3 ? "rd" : "th";
    return `${number}${suffix}`;
  }

  function normalizeDoi(value){
    const raw = clean(value).replace(/^doi:\s*/iu, "").replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "").replace(/[.,;:]+$/u, "");
    return /^10\.\d{4,9}\/\S+$/iu.test(raw) ? raw : "";
  }

  function locatorInfo(value){
    const raw = clean(value);
    if(!raw) return {kind:"", value:""};
    const doi = normalizeDoi(raw);
    if(doi) return {kind:"doi", value:doi, url:`https://doi.org/${doi}`};
    try {
      const url = new URL(raw);
      if(!["http:", "https:"].includes(url.protocol)) return {kind:"invalid", value:raw};
      return {kind:"url", value:url.href};
    } catch(_error){ return {kind:"invalid", value:raw}; }
  }

  function dateParts(value){
    const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/u);
    if(!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? {year, month, day} : null;
  }

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MONTHS_SHORT = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
  const MONTHS_IEEE = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
  const dateApa = (value, suffix="") => { const date = dateParts(value); return date ? `${date.year}${suffix}, ${MONTHS[date.month - 1]} ${date.day}` : ""; };
  const dateLong = value => { const date = dateParts(value); return date ? `${MONTHS[date.month - 1]} ${date.day}, ${date.year}` : ""; };
  const dateDayFirst = value => { const date = dateParts(value); return date ? `${date.day} ${MONTHS[date.month - 1]} ${date.year}` : ""; };
  const dateMla = value => { const date = dateParts(value); return date ? `${date.day} ${MONTHS_SHORT[date.month - 1]} ${date.year}` : ""; };
  const dateIeee = value => { const date = dateParts(value); return date ? `${MONTHS_IEEE[date.month - 1]} ${date.day}, ${date.year}` : ""; };

  function recordFromForm(){
    const source = document.querySelector('input[name="citationSource"]:checked')?.value || "book";
    const publicationDate = clean(byId("citationPublicationDate")?.value);
    return {
      id:crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      source:SOURCE_VALUES.has(source) ? source : "book",
      authors:parseAuthors(byId("citationAuthors")?.value, byId("citationAuthorType")?.value || "person"),
      title:clean(byId("citationTitle")?.value),
      year:source === "website" ? String(dateParts(publicationDate)?.year || "") : clean(byId("citationYear")?.value),
      publicationDate,
      accessDate:clean(byId("citationAccessDate")?.value),
      publisher:clean(byId("citationPublisher")?.value),
      publisherPlace:clean(byId("citationPlace")?.value),
      edition:clean(byId("citationEdition")?.value),
      containerTitle:source === "journal" ? clean(byId("citationJournal")?.value) : clean(byId("citationSite")?.value),
      volume:clean(byId("citationVolume")?.value),
      issue:clean(byId("citationIssue")?.value),
      pages:clean(byId("citationPages")?.value),
      pinpoint:clean(byId("citationPinpoint")?.value),
      locator:clean(byId("citationLocator")?.value)
    };
  }

  function selectedStyle(){
    const style = document.querySelector('input[name="citationStyle"]:checked')?.value || "apa";
    return STYLE_VALUES.has(style) ? style : "apa";
  }

  function validateRecord(record){
    const errors = [];
    const warnings = [];
    if(!record.title) errors.push("citationMissingTitle");
    if(record.year && !/^\d{4}$/u.test(record.year)) errors.push("citationInvalidYear");
    if(record.locator && locatorInfo(record.locator).kind === "invalid") errors.push("citationInvalidUrl");
    if(!record.authors.length) warnings.push("citationAuthorWarning");
    if(record.source === "book" && !record.publisher) warnings.push("citationBookPublisherWarning");
    if(record.source === "journal" && !record.containerTitle) warnings.push("citationJournalWarning");
    if(record.source === "website" && locatorInfo(record.locator).kind !== "url") warnings.push("citationWebsiteWarning");
    return {errors, warnings};
  }

  const italicPair = value => pair(value, `<em>${escapeHtml(value)}</em>`);
  const locatorFor = (record, style) => {
    const locator = locatorInfo(record.locator);
    if(!locator.kind || locator.kind === "invalid") return "";
    if(style === "ieee" && locator.kind === "doi") return `doi: ${locator.value}`;
    return locator.kind === "doi" ? locator.url : locator.value;
  };

  function formatApa(record){
    const author = apaAuthors(record.authors);
    const year = record.year ? `${record.year}${record.yearSuffix || ""}` : "n.d.";
    const lead = [author ? sentence(author) : "", `(${year}).`].filter(Boolean).join(" ");
    const edition = ordinalEdition(record.edition);
    const locator = locatorFor(record, "apa");
    if(record.source === "book"){
      const title = pair(`${record.title}${edition ? ` (${edition} ed.)` : ""}`, `<em>${escapeHtml(record.title)}</em>${edition ? ` (${escapeHtml(edition)} ed.)` : ""}`);
      if(!author) return joinWords(withPeriod(title), pair(`(${year}).`), record.publisher ? pair(sentence(record.publisher)) : pair(), locator ? pair(locator) : pair());
      const body = joinWords(pair(lead), withPeriod(title), record.publisher ? pair(sentence(record.publisher)) : pair(), locator ? pair(locator) : pair());
      return body;
    }
    if(record.source === "journal"){
      const article = pair(sentence(record.title));
      let containerPlain = record.containerTitle;
      let containerHtml = escapeHtml(record.containerTitle);
      if(record.volume){ containerPlain += `${containerPlain ? ", " : ""}${record.volume}`; containerHtml += `${containerHtml ? ", " : ""}<em>${escapeHtml(record.volume)}</em>`; }
      if(record.issue){ containerPlain += `(${record.issue})`; containerHtml += `(${escapeHtml(record.issue)})`; }
      if(record.pages){ containerPlain += `${containerPlain ? ", " : ""}${record.pages}`; containerHtml += `${containerHtml ? ", " : ""}${escapeHtml(record.pages)}`; }
      const container = containerPlain ? pair(sentence(containerPlain), `<em>${escapeHtml(record.containerTitle)}</em>${record.volume ? `, <em>${escapeHtml(record.volume)}</em>` : ""}${record.issue ? `(${escapeHtml(record.issue)})` : ""}${record.pages ? `, ${escapeHtml(record.pages)}` : ""}.`) : pair();
      if(!author) return joinWords(article, pair(`(${year}).`), container, locator ? pair(locator) : pair());
      return joinWords(pair(lead), article, container, locator ? pair(locator) : pair());
    }
    const date = record.publicationDate ? dateApa(record.publicationDate, record.yearSuffix || "") : "";
    const datedLead = author ? `${sentence(author)} (${date || record.year || "n.d."}).` : `(${date || record.year || "n.d."}).`;
    const sameSite = record.authors.length === 1 && record.authors[0].kind === "organization" && record.authors[0].literal.toLocaleLowerCase() === record.containerTitle.toLocaleLowerCase();
    if(!author) return joinWords(withPeriod(italicPair(record.title)), pair(datedLead), record.containerTitle ? pair(sentence(record.containerTitle)) : pair(), locator ? pair(locator) : pair());
    return joinWords(pair(datedLead), withPeriod(italicPair(record.title)), !sameSite && record.containerTitle ? pair(sentence(record.containerTitle)) : pair(), locator ? pair(locator) : pair());
  }

  function formatMla(record){
    const author = mlaAuthors(record.authors);
    const lead = author ? sentence(author) : "";
    const locator = locatorFor(record, "mla");
    const edition = ordinalEdition(record.edition);
    if(record.source === "book"){
      const details = [edition ? `${edition} ed.` : "", record.publisher, record.year].filter(Boolean).join(", ");
      return joinWords(pair(lead), withPeriod(italicPair(record.title)), details ? pair(sentence(details)) : pair(), locator ? pair(sentence(locator)) : pair());
    }
    if(record.source === "journal"){
      const details = [record.volume ? `vol. ${record.volume}` : "", record.issue ? `no. ${record.issue}` : "", record.year, record.pages ? `${/^\d/u.test(record.pages) ? "pp. " : ""}${record.pages}` : "", locator].filter(Boolean).join(", ");
      return joinWords(pair(lead), quotedTerminalPair(record.title), record.containerTitle ? pair(`${record.containerTitle},`, `<em>${escapeHtml(record.containerTitle)}</em>,`) : pair(), details ? pair(sentence(details)) : pair());
    }
    const date = dateMla(record.publicationDate);
    const details = [date, locator].filter(Boolean).join(", ");
    const accessed = dateMla(record.accessDate);
    return joinWords(pair(lead), quotedTerminalPair(record.title), record.containerTitle ? pair(`${record.containerTitle},`, `<em>${escapeHtml(record.containerTitle)}</em>,`) : pair(), details ? pair(sentence(details)) : pair(), accessed ? pair(`Accessed ${accessed}.`) : pair());
  }

  function formatChicago(record){
    const author = chicagoAuthors(record.authors);
    const lead = author ? sentence(author) : "";
    const locator = locatorFor(record, "chicago");
    const edition = ordinalEdition(record.edition);
    if(record.source === "book"){
      const publication = record.publisher ? `${record.publisherPlace ? `${record.publisherPlace}: ` : ""}${record.publisher}${record.year ? `, ${record.year}` : ""}.` : record.year ? `${record.year}.` : "";
      return joinWords(pair(lead), withPeriod(italicPair(record.title)), edition ? pair(`${edition} ed.`) : pair(), pair(publication), locator ? pair(sentence(locator)) : pair());
    }
    if(record.source === "journal"){
      let journal = record.containerTitle;
      if(record.volume) journal += `${journal ? " " : ""}${record.volume}`;
      if(record.issue) journal += `, no. ${record.issue}`;
      if(record.year) journal += ` (${record.year})`;
      if(record.pages) journal += `: ${record.pages}`;
      const journalHtml = record.containerTitle ? `<em>${escapeHtml(record.containerTitle)}</em>${record.volume ? ` ${escapeHtml(record.volume)}` : ""}${record.issue ? `, no. ${escapeHtml(record.issue)}` : ""}${record.year ? ` (${escapeHtml(record.year)})` : ""}${record.pages ? `: ${escapeHtml(record.pages)}` : ""}.` : "";
      return joinWords(pair(lead), quotedTerminalPair(record.title), journal ? pair(sentence(journal), journalHtml) : pair(), locator ? pair(sentence(locator)) : pair());
    }
    const date = dateLong(record.publicationDate);
    const accessed = dateLong(record.accessDate);
    return joinWords(pair(lead), quotedTerminalPair(record.title), record.containerTitle ? pair(sentence(record.containerTitle)) : pair(), date ? pair(`${date}.`) : accessed ? pair(`Accessed ${accessed}.`) : pair(), locator ? pair(sentence(locator)) : pair());
  }

  function formatHarvard(record){
    const author = harvardAuthors(record.authors);
    const year = record.year ? `${record.year}${record.yearSuffix || ""}` : "no date";
    const lead = `${author ? `${author} ` : ""}(${year})`;
    const locator = locatorFor(record, "harvard");
    const edition = ordinalEdition(record.edition);
    const available = locator ? `Available at: ${locator}` : "";
    const accessed = dateDayFirst(record.accessDate);
    if(record.source === "book"){
      if(!author) return joinWords(withPeriod(italicPair(record.title)), pair(`(${year})`), edition ? pair(`${edition} edn.`) : pair(), record.publisher ? pair(sentence(record.publisher)) : pair(), available ? pair(`${available}${accessed && locatorInfo(record.locator).kind === "url" ? ` (Accessed: ${accessed})` : ""}.`) : pair());
      return joinWords(pair(lead), withPeriod(italicPair(record.title)), edition ? pair(`${edition} edn.`) : pair(), record.publisher ? pair(sentence(record.publisher)) : pair(), available ? pair(`${available}${accessed && locatorInfo(record.locator).kind === "url" ? ` (Accessed: ${accessed})` : ""}.`) : pair());
    }
    if(record.source === "journal"){
      let journal = record.containerTitle;
      if(record.volume) journal += `${journal ? ", " : ""}${record.volume}`;
      if(record.issue) journal += `(${record.issue})`;
      if(record.pages) journal += `${journal ? ", " : ""}${/^\d/u.test(record.pages) ? "pp. " : ""}${record.pages}`;
      if(!author) return joinWords(pair(`${quoted(record.title, true)} (${year}),`, `${htmlQuoted(record.title, true)} (${escapeHtml(year)}),`), journal ? pair(`${sentence(journal)}`, `${record.containerTitle ? `<em>${escapeHtml(record.containerTitle)}</em>${escapeHtml(journal.slice(record.containerTitle.length))}` : escapeHtml(journal)}.`) : pair(), available ? pair(`${available}${accessed ? ` (Accessed: ${accessed})` : ""}.`) : pair());
      return joinWords(pair(lead), pair(`${quoted(record.title, true)},`, `${htmlQuoted(record.title, true)},`), journal ? pair(`${sentence(journal)}`, `${record.containerTitle ? `<em>${escapeHtml(record.containerTitle)}</em>${escapeHtml(journal.slice(record.containerTitle.length))}` : escapeHtml(journal)}.`) : pair(), available ? pair(`${available}${accessed ? ` (Accessed: ${accessed})` : ""}.`) : pair());
    }
    if(!author) return joinWords(withPeriod(italicPair(record.title)), pair(`(${year})`), available ? pair(`${available}${accessed ? ` (Accessed: ${accessed})` : ""}.`) : pair());
    return joinWords(pair(lead), withPeriod(italicPair(record.title)), available ? pair(`${available}${accessed ? ` (Accessed: ${accessed})` : ""}.`) : pair());
  }

  function formatIeee(record, sequence=1){
    const author = ieeeAuthors(record.authors);
    const lead = `[${sequence}]${author ? ` ${author},` : ""}`;
    const locator = locatorFor(record, "ieee");
    const edition = ordinalEdition(record.edition);
    if(record.source === "book"){
      const publication = record.publisher ? `${record.publisherPlace ? `${record.publisherPlace}: ` : ""}${record.publisher}${record.year ? `, ${record.year}` : ""}` : record.year;
      const plain = `${lead} ${record.title}${edition ? `, ${edition} ed.` : "."}${publication ? ` ${publication}.` : ""}${locator ? ` ${locator}.` : ""}`;
      const html = `${escapeHtml(lead)} <em>${escapeHtml(record.title)}</em>${edition ? `, ${escapeHtml(edition)} ed.` : "."}${publication ? ` ${escapeHtml(publication)}.` : ""}${locator ? ` ${escapeHtml(locator)}.` : ""}`;
      return pair(plain, html);
    }
    if(record.source === "journal"){
      const details = [record.volume ? `vol. ${record.volume}` : "", record.issue ? `no. ${record.issue}` : "", record.pages ? `${/^\d/u.test(record.pages) ? "pp. " : ""}${record.pages}` : "", record.year, locator].filter(Boolean).join(", ");
      return withPeriod(joinWords(pair(lead), quotedTerminalPair(record.title, ","), record.containerTitle ? pair(`${record.containerTitle},`, `<em>${escapeHtml(record.containerTitle)}</em>,`) : pair(), pair(details)));
    }
    const accessed = dateIeee(record.accessDate);
    const available = locatorInfo(record.locator).kind === "url" ? locatorFor(record, "ieee") : locatorInfo(record.locator).url || locator;
    const result = joinWords(pair(author ? `[${sequence}] ${sentence(author)}` : `[${sequence}]`), quotedTerminalPair(record.title), record.containerTitle ? pair(sentence(record.containerTitle)) : pair(), accessed ? pair(`Accessed: ${accessed}.`) : pair(), available ? pair(`[Online]. Available: ${available}`) : pair());
    return result;
  }

  function inTextCitation(record, style, sequence=1){
    const family = record.authors.map(authorFamily).filter(Boolean);
    const year = record.year ? `${record.year}${record.yearSuffix || ""}` : "n.d.";
    const pinpoint = clean(record.pinpoint);
    const pageLabel = pinpoint && /^\d/u.test(pinpoint) ? (/[–—,-]/u.test(pinpoint) ? "pp." : "p.") : "";
    if(style === "ieee") return pinpoint ? `[${sequence}, ${pageLabel ? `${pageLabel} ` : ""}${pinpoint}]` : `[${sequence}]`;
    if(style === "mla"){
      const author = family.length ? `${family[0]}${family.length === 2 ? ` and ${family[1]}` : family.length > 2 ? " et al." : ""}` : record.title;
      return `(${author}${pinpoint ? ` ${pinpoint}` : ""})`;
    }
    if(style === "chicago"){
      const author = record.authors[0] ? authorFamily(record.authors[0]) : "";
      const shortTitle = record.source === "book" ? record.title : quoted(record.title);
      return `${[author, shortTitle, pinpoint].filter(Boolean).join(", ")}.`;
    }
    if(style === "harvard"){
      const author = !family.length ? record.title : family.length === 1 ? family[0] : family.length === 2 ? `${family[0]} and ${family[1]}` : `${family[0]} et al.`;
      return `(${author}, ${record.year ? `${record.year}${record.yearSuffix || ""}` : "no date"}${pinpoint ? `, ${pageLabel ? `${pageLabel} ` : ""}${pinpoint}` : ""})`;
    }
    const author = !family.length ? record.title : family.length === 1 ? family[0] : family.length === 2 ? `${family[0]} & ${family[1]}` : `${family[0]} et al.`;
    return `(${author}, ${year}${pinpoint ? `, ${pageLabel ? `${pageLabel} ` : ""}${pinpoint}` : ""})`;
  }

  function formatRecord(record, style=selectedStyle(), sequence=1){
    const resolved = STYLE_VALUES.has(style) ? style : "apa";
    const formatted = resolved === "apa" ? formatApa(record)
      : resolved === "mla" ? formatMla(record)
        : resolved === "chicago" ? formatChicago(record)
          : resolved === "harvard" ? formatHarvard(record)
            : formatIeee(record, sequence);
    return {
      plain:formatted.plain.replace(/\s+([,.;:])/gu, "$1").replace(/\s{2,}/gu, " ").trim(),
      html:formatted.html.replace(/\s+([,.;:])/gu, "$1").replace(/\s{2,}/gu, " ").trim(),
      inline:inTextCitation(record, resolved, sequence)
    };
  }

  function currentUserId(){
    try { return typeof currentUser !== "undefined" ? currentUser?.id || "local" : "local"; }
    catch(_error){ return "local"; }
  }

  const RECORD_STRING_FIELDS = ["title", "year", "publicationDate", "accessDate", "publisher", "publisherPlace", "edition", "containerTitle", "volume", "issue", "pages", "pinpoint", "locator"];

  function normalizeRecord(item, index=0){
    if(!item || !SOURCE_VALUES.has(item.source)) return null;
    const record = {id:clean(item.id) || `saved-${index}`, source:item.source, authors:[]};
    record.authors = Array.isArray(item.authors) ? item.authors.map(author => {
      if(author?.kind === "organization" && clean(author.literal)) return {kind:"organization", literal:clean(author.literal)};
      if(author?.kind === "person" && (clean(author.family) || clean(author.given))) return {kind:"person", family:clean(author.family), given:clean(author.given)};
      return null;
    }).filter(Boolean) : [];
    RECORD_STRING_FIELDS.forEach(field => { record[field] = clean(item[field]); });
    return record.title ? record : null;
  }

  function loadLibrary(userId=currentUserId()){
    state.storageKey = `${STORAGE_PREFIX}:${userId || "local"}`;
    try {
      const parsed = JSON.parse(localStorage.getItem(state.storageKey) || "[]");
      state.library = Array.isArray(parsed) ? parsed.map(normalizeRecord).filter(Boolean).slice(0, MAX_LIBRARY_ITEMS) : [];
    } catch(_error){ state.library = []; }
  }

  function saveLibrary(){
    try {
      localStorage.setItem(state.storageKey, JSON.stringify(state.library.slice(0, MAX_LIBRARY_ITEMS)));
      return true;
    } catch(_error){ return false; }
  }

  function setStatus(message="", kind="", announce=false){
    const target = byId("citationStatus");
    if(!target) return;
    target.setAttribute("aria-live", announce ? "polite" : "off");
    target.textContent = message;
    target.className = `citation-engine-state${kind ? ` ${kind}` : ""}`;
  }

  function setPreviewPlaceholder(){
    const reference = byId("citationOutput");
    const inline = byId("citationInlineOutput");
    if(reference){ reference.className = "citation-render is-placeholder"; reference.textContent = tr("citationPreviewPlaceholder"); }
    if(inline){ inline.className = "citation-inline-render is-placeholder"; inline.textContent = tr("citationInlinePlaceholder"); }
    state.preview = null;
    byId("copyCitation") && (byId("copyCitation").disabled = true);
    byId("addCitation") && (byId("addCitation").disabled = true);
  }

  function renderPreview({announce=false}={}){
    const record = recordFromForm();
    const style = selectedStyle();
    const validation = validateRecord(record);
    byId("citationPreviewStyle").textContent = document.querySelector('input[name="citationStyle"]:checked + span')?.textContent || "APA 7";
    byId("citationSecondaryLabel").textContent = tr(style === "chicago" ? "citationNoteLabel" : "citationInlineLabel");
    if(!record.title){
      setPreviewPlaceholder();
      const hasOtherDetails = !!(record.authors.length || record.year || record.publisher || record.containerTitle || record.locator);
      setStatus(hasOtherDetails ? tr("citationMissingTitle") : "", hasOtherDetails ? "error" : "", announce && hasOtherDetails);
      return;
    }
    if(validation.errors.length){
      setPreviewPlaceholder();
      setStatus(tr(validation.errors[0]), "error", announce);
      return;
    }
    const formatted = formatRecord(record, style, 1);
    const reference = byId("citationOutput");
    const inline = byId("citationInlineOutput");
    reference.className = "citation-render";
    reference.innerHTML = `<div class="csl-bib-body"><div class="csl-entry">${formatted.html}</div></div>`;
    inline.className = "citation-inline-render";
    inline.textContent = formatted.inline;
    state.preview = {record, style, ...formatted};
    byId("copyCitation").disabled = false;
    byId("addCitation").disabled = false;
    setStatus(validation.warnings.length ? tr(validation.warnings[0]) : tr("citationReady"), validation.warnings.length ? "" : "success", announce);
  }

  function schedulePreview(){
    if(state.previewTimer) clearTimeout(state.previewTimer);
    state.previewTimer = window.setTimeout(() => { state.previewTimer = null; renderPreview(); }, 120);
  }

  function syncSourceFields({render=true}={}){
    const source = document.querySelector('input[name="citationSource"]:checked')?.value || "book";
    document.querySelectorAll("[data-citation-sources]").forEach(field => {
      const sources = field.dataset.citationSources.split(/\s+/u);
      field.hidden = !sources.includes(source);
      field.querySelectorAll("input").forEach(input => { input.disabled = field.hidden; });
    });
    if(render) schedulePreview();
  }

  function syncStyle({render=true}={}){
    const style = selectedStyle();
    byId("citationStyleAdvice").textContent = tr(`style${style[0].toLocaleUpperCase()}${style.slice(1)}Advice`);
    if(render) renderPreview();
    renderLibrary();
  }

  function fingerprint(record){
    return JSON.stringify([record.source, record.title.toLocaleLowerCase(), record.year, record.authors.map(author => author.kind === "organization" ? author.literal : `${author.family}|${author.given}`), normalizeDoi(record.locator) || locatorInfo(record.locator).value]);
  }

  function addCurrentCitation(){
    if(!state.preview) return;
    const next = {...state.preview.record, id:crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`};
    const key = fingerprint(next);
    if(state.library.some(item => fingerprint(item) === key)){
      setStatus(tr("citationDuplicate"), "", true);
      return;
    }
    const previous = [...state.library];
    state.library.push(next);
    if(state.library.length > MAX_LIBRARY_ITEMS) state.library.shift();
    if(!saveLibrary()){
      state.library = previous;
      setStatus(tr("bibliographyStorageFailed"), "error", true);
      return;
    }
    renderLibrary();
    setStatus(tr("citationAdded"), "success", true);
  }

  function orderedLibrary(){
    if(selectedStyle() === "ieee") return [...state.library];
    const ordered = [...state.library].sort((a, b) => {
      const authorA = a.authors.length ? a.authors.map(authorFamily).join("|") : a.title;
      const authorB = b.authors.length ? b.authors.map(authorFamily).join("|") : b.title;
      return clean(authorA).localeCompare(clean(authorB), undefined, {sensitivity:"base"})
        || clean(a.year).localeCompare(clean(b.year), undefined, {numeric:true})
        || clean(a.title).localeCompare(clean(b.title), undefined, {sensitivity:"base"});
    });
    if(!["apa", "harvard"].includes(selectedStyle())) return ordered;
    const groups = new Map();
    ordered.forEach((record, index) => {
      if(!record.authors.length || !record.year) return;
      const key = `${record.authors.map(author => author.kind === "organization" ? clean(author.literal).toLocaleLowerCase() : `${clean(author.family).toLocaleLowerCase()}|${clean(author.given).toLocaleLowerCase()}`).join(";")}::${record.year}`;
      const indexes = groups.get(key) || [];
      indexes.push(index);
      groups.set(key, indexes);
    });
    const suffixes = new Map();
    groups.forEach(indexes => {
      if(indexes.length < 2) return;
      indexes.forEach((index, suffixIndex) => suffixes.set(index, String.fromCharCode(97 + suffixIndex)));
    });
    return ordered.map((record, index) => suffixes.has(index) ? {...record, yearSuffix:suffixes.get(index)} : record);
  }

  function renderLibrary(){
    const list = byId("citationLibraryList");
    if(!list) return;
    list.replaceChildren();
    const ordered = orderedLibrary();
    byId("citationLibraryCount").textContent = tr("bibliographyCount", {count:ordered.length});
    byId("copyBibliography").disabled = !ordered.length;
    byId("clearBibliography").disabled = !ordered.length;
    if(!ordered.length){
      const empty = document.createElement("li");
      empty.className = "citation-library-empty";
      empty.textContent = tr("bibliographyEmpty");
      list.append(empty);
      return;
    }
    ordered.forEach((record, index) => {
      const formatted = formatRecord(record, selectedStyle(), index + 1);
      const item = document.createElement("li");
      item.className = "citation-library-item";
      const entry = document.createElement("div");
      entry.className = "citation-library-entry";
      entry.innerHTML = `<div class="csl-entry">${formatted.html}</div>`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "citation-library-remove";
      remove.textContent = tr("bibliographyRemove");
      remove.dataset.citationRemove = record.id;
      remove.setAttribute("aria-label", `${tr("bibliographyRemove")}: ${record.title}`);
      item.append(entry, remove);
      list.append(item);
    });
  }

  async function copyRich(plainText, html){
    if(navigator.clipboard?.write && typeof ClipboardItem === "function"){
      try {
        await navigator.clipboard.write([new ClipboardItem({
          "text/plain":new Blob([plainText], {type:"text/plain"}),
          "text/html":new Blob([html], {type:"text/html"})
        })]);
        return "rich";
      } catch(_error){}
    }
    try {
      await navigator.clipboard.writeText(plainText);
      return "plain";
    } catch(_error){ return "failed"; }
  }

  async function copyCurrentCitation(){
    if(!state.preview) return;
    const result = await copyRich(state.preview.plain, `<div style="padding-left:2em;text-indent:-2em">${state.preview.html}</div>`);
    setStatus(tr(result === "rich" ? "citationCopied" : result === "plain" ? "citationCopiedPlain" : "citationCopyFailed"), result === "failed" ? "error" : "success", true);
  }

  async function copyBibliography(){
    const ordered = orderedLibrary();
    if(!ordered.length) return;
    const formatted = ordered.map((record, index) => formatRecord(record, selectedStyle(), index + 1));
    const plain = formatted.map(item => item.plain).join("\n\n");
    const html = `<div>${formatted.map(item => `<div style="margin:0 0 1em;padding-left:2em;text-indent:-2em">${item.html}</div>`).join("")}</div>`;
    const result = await copyRich(plain, html);
    setStatus(tr(result === "failed" ? "citationCopyFailed" : "bibliographyCopied"), result === "failed" ? "error" : "success", true);
  }

  function localDateValue(){
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function resetFormState(){
    byId("citationForm")?.reset();
    if(byId("citationAccessDate")) byId("citationAccessDate").value = localDateValue();
    syncSourceFields({render:false});
    syncStyle({render:false});
    setPreviewPlaceholder();
    setStatus("");
  }

  function clearForm(){
    resetFormState();
    byId("citationTitle")?.focus();
  }

  function clearBibliography(){
    if(!state.library.length || !window.confirm(tr("bibliographyClearConfirm"))) return;
    const previous = [...state.library];
    state.library = [];
    if(!saveLibrary()){
      state.library = previous;
      setStatus(tr("bibliographyStorageFailed"), "error", true);
      return;
    }
    renderLibrary();
    byId("citationTitle")?.focus();
    setStatus(tr("bibliographyCleared"), "success", true);
  }

  function refreshLanguage(){
    document.querySelectorAll("[data-academic-i18n]").forEach(element => { element.textContent = tr(element.dataset.academicI18n); });
    document.querySelectorAll("[data-academic-i18n-placeholder]").forEach(element => { element.placeholder = tr(element.dataset.academicI18nPlaceholder); });
    document.querySelectorAll("[data-academic-i18n-aria-label]").forEach(element => { element.setAttribute("aria-label", tr(element.dataset.academicI18nAriaLabel)); });
    syncStyle();
  }

  function activate(){
    const key = `${STORAGE_PREFIX}:${currentUserId()}`;
    if(state.storageKey !== key){
      resetFormState();
      loadLibrary();
      renderLibrary();
    }
    refreshLanguage();
    syncSourceFields({render:false});
    renderPreview();
  }

  function reset(nextUserId){
    if(state.previewTimer){ clearTimeout(state.previewTimer); state.previewTimer = null; }
    state.preview = null;
    resetFormState();
    loadLibrary(nextUserId || "local");
    renderLibrary();
  }

  function bind(){
    if(state.initialized || !byId("citationForm")) return;
    state.initialized = true;
    loadLibrary();
    if(byId("citationAccessDate") && !byId("citationAccessDate").value) byId("citationAccessDate").value = localDateValue();
    byId("citationForm").addEventListener("submit", event => event.preventDefault());
    byId("citationForm").addEventListener("input", schedulePreview);
    byId("citationForm").addEventListener("change", event => {
      if(event.target.name === "citationSource") syncSourceFields();
      else if(event.target.name === "citationStyle") syncStyle();
      else schedulePreview();
    });
    byId("clearCitation")?.addEventListener("click", clearForm);
    byId("copyCitation")?.addEventListener("click", () => void copyCurrentCitation());
    byId("addCitation")?.addEventListener("click", addCurrentCitation);
    byId("copyBibliography")?.addEventListener("click", () => void copyBibliography());
    byId("clearBibliography")?.addEventListener("click", clearBibliography);
    byId("citationLibraryList")?.addEventListener("click", event => {
      const button = event.target.closest?.("[data-citation-remove]");
      if(!button) return;
      const previous = [...state.library];
      const removeButtons = [...byId("citationLibraryList").querySelectorAll("[data-citation-remove]")];
      const focusIndex = Math.max(0, removeButtons.indexOf(button));
      state.library = state.library.filter(item => item.id !== button.dataset.citationRemove);
      if(!saveLibrary()){
        state.library = previous;
        setStatus(tr("bibliographyStorageFailed"), "error", true);
        return;
      }
      renderLibrary();
      const nextButtons = [...byId("citationLibraryList").querySelectorAll("[data-citation-remove]")];
      (nextButtons[Math.min(focusIndex, nextButtons.length - 1)] || byId("citationTitle"))?.focus();
      setStatus(tr("bibliographyRemoved"), "success", true);
    });
    refreshLanguage();
    syncSourceFields();
    renderLibrary();
    schedulePreview();
  }

  window.ConCourseAcademicTools = Object.freeze({
    activate,
    reset,
    refreshLanguage,
    __test:Object.freeze({formatRecord, parseAuthors, normalizeDoi, validateRecord})
  });

  bind();
})();
