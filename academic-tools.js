(() => {
  "use strict";

  const STORAGE_PREFIX = "concourse-citation-library-v1";
  const MAX_LIBRARY_ITEMS = 60;
  const MAX_REFERENCE_LENGTH = 5000;
  const STYLE_VALUES = new Set(["apa", "mla", "chicago", "harvard", "ieee"]);
  const SOURCE_VALUES = new Set(["book", "journal", "website"]);
  const CITATION_EXAMPLES = Object.freeze({
    website:Object.freeze({
      source:"website",
      fields:Object.freeze({
        citationAuthorType:"organization",
        citationAuthors:"W3C Web Accessibility Initiative (WAI)",
        citationTitle:"Introduction to Web Accessibility",
        citationYear:"",
        citationPublicationDate:"",
        citationSite:"W3C Web Accessibility Initiative",
        citationLocator:"https://www.w3.org/WAI/fundamentals/accessibility-intro/"
      })
    }),
    journal:Object.freeze({
      source:"journal",
      fields:Object.freeze({
        citationAuthorType:"person",
        citationAuthors:"Zimmerman, Barry J.",
        citationTitle:"Becoming a Self-Regulated Learner: An Overview",
        citationYear:"2002",
        citationJournal:"Theory Into Practice",
        citationVolume:"41",
        citationIssue:"2",
        citationPages:"64–70",
        citationLocator:"10.1207/s15430421tip4102_2"
      })
    }),
    book:Object.freeze({
      source:"book",
      fields:Object.freeze({
        citationAuthorType:"person",
        citationAuthors:"Booth, Wayne C.; Colomb, Gregory G.; Williams, Joseph M.",
        citationTitle:"The Craft of Research",
        citationYear:"2016",
        citationPublisher:"University of Chicago Press",
        citationEdition:"4"
      })
    })
  });

  const COPY = Object.freeze({
    en: Object.freeze({
      toolsWorkspaceTitle:"Citation Studio",
      toolsWorkspaceIntro:"Build a polished reference, check its in-text form, and keep a bibliography for your current project.",
      toolsLocalNote:"Manual entries and saved bibliographies stay on this device. Scholarly keyword results use Crossref’s free public metadata; selected pages are checked by ConCourse.",
      citationStyleLegend:"Citation style",
      sourceTypeLegend:"Source type",
      sourceBook:"Book",
      sourceJournal:"Journal article",
      sourceWebsite:"Website",
      citationEntryModeLegend:"Add this website",
      citationAutomaticMode:"Find automatically",
      citationAutomaticModeHint:"Paste any public URL, or search scholarly works by title, author, DOI, or ISBN.",
      citationManualMode:"Enter manually",
      citationManualModeHint:"Type every source detail yourself.",
      citationSearchLabel:"Website URL or search words",
      citationSearchPlaceholder:"Paste a URL, or search by title, author, DOI, or ISBN",
      citationWebsiteUrl:"Website URL or search words",
      citationWebsiteUrlPlaceholder:"Paste a URL, or search by title, author, or topic",
      citationFindSource:"Search sources",
      citationFindingSource:"Searching public citation metadata…",
      citationLookupNote:"A pasted URL is checked directly. Keyword searches use Crossref’s free public scholarly metadata. Selecting a result lets ConCourse verify it before importing. Review every field.",
      citationLookupRequired:"Enter a website URL or search words first.",
      citationLookupInvalid:"Enter at least two characters, or use a complete public http(s) website URL.",
      citationLookupSuccess:"Source details found. Review and correct the imported fields below.",
      citationLookupPartial:"Some details were found. Complete the missing fields below before using the citation.",
      citationLookupFailed:"ConCourse could not read this page. You can still enter the details manually below.",
      citationLookupUnavailable:"Automatic lookup is temporarily unavailable. Enter the source details manually below.",
      citationLookupRateLimited:"You have made several lookups in a short time. Wait a minute, then try again.",
      citationLookupDailyLimited:"You have reached today’s source-search limit. Try again tomorrow, paste an exact URL, or enter the source manually.",
      citationLookupSessionExpired:"Your session has expired. Sign in again before using automatic lookup.",
      citationLookupUnsupported:"This page cannot be read automatically. Enter the source details manually below.",
      citationLookupTimedOut:"The selected page took too long to respond. No citation details were changed. Try again or enter the source manually.",
      citationLookupSignIn:"Sign in before using automatic website lookup.",
      citationLookupReplaceConfirm:"Finding a new source will replace the current website draft and edited reference. Continue?",
      citationSearchResultsTitle:"Choose the correct source",
      citationSearchResultCount:"{count} results found",
      citationSearchNoResults:"No matching sources were found. Try a more specific title, author, or URL, or enter the source manually.",
      citationSearchExactOnly:"The exact page was found. Select it to import and review its details.",
      citationSearchUnavailable:"Scholarly keyword search is temporarily unavailable. Paste a complete public URL for exact lookup, or enter the source manually.",
      citationSearchReview:"Compare the title, author, website, date, and URL before selecting a source.",
      citationSelectSource:"Select source",
      citationSelectingSource:"Checking the selected page…",
      citationResultUnknownAuthor:"Author not listed",
      citationResultExact:"Exact URL match",
      citationSearchAttribution:"Scholarly metadata provided by Crossref",
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
      citationLocatorPlaceholder:"10.1000/182 or https://…",
      citationPinpoint:"Cited page or locator",
      citationPinpointPlaceholder:"42, 115–117, or sec. 3",
      citationClear:"Clear fields",
      citationPreviewEyebrow:"Live output",
      citationPreviewTitle:"Your reference",
      citationReferenceLabel:"Editable reference-list entry",
      citationInlineLabel:"In-text citation",
      citationNoteLabel:"Short note",
      citationPreviewPlaceholder:"Enter a title to generate a reference, or type one directly.",
      citationInlinePlaceholder:"The in-text form will appear here.",
      citationEdited:"Edited",
      citationEditHint:"You can correct the generated entry directly in this box.",
      citationRestore:"Restore generated version",
      citationRestored:"The generated reference has been restored.",
      citationEditedStatus:"Your edited reference will be used when you copy or save it.",
      citationEditedSourceChanged:"Source details changed. Your edited reference is preserved until you restore the generated version.",
      citationCopy:"Copy reference",
      citationAdd:"Add to bibliography",
      citationReady:"Reference updated.",
      citationCopied:"Reference copied with formatting.",
      citationCopiedPlain:"Reference copied as plain text.",
      citationCopyFailed:"Copying failed. Select the reference and copy it manually.",
      citationAdded:"Added to this project bibliography.",
      citationUpdated:"The saved reference has been updated.",
      citationDuplicate:"This source is already in the bibliography.",
      citationMissingTitle:"Add the source title to generate a reference.",
      citationInvalidYear:"Use a four-digit publication year or leave it blank.",
      citationInvalidUrl:"Use a complete http(s) URL or a DOI beginning with 10.",
      citationInvalidDate:"Use a real publication date or leave it blank.",
      citationReferenceLimit:"References can contain up to 5,000 characters. Extra text was removed.",
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
      toolsLocalNote:"手动输入和已保存的参考书目只保存在此设备。学术关键词结果使用 Crossref 免费公共元数据；所选网页由 ConCourse 核对。",
      citationStyleLegend:"引用格式",
      sourceTypeLegend:"资料类型",
      sourceBook:"书籍",
      sourceJournal:"期刊文章",
      sourceWebsite:"网页",
      citationEntryModeLegend:"添加这个网页",
      citationAutomaticMode:"自动查找",
      citationAutomaticModeHint:"粘贴任何公开网址，或按标题、作者、DOI 或 ISBN 搜索学术资料。",
      citationManualMode:"手动输入",
      citationManualModeHint:"自行填写每一项资料详情。",
      citationSearchLabel:"网页网址或搜索词",
      citationSearchPlaceholder:"粘贴网址，或按标题、作者、DOI 或 ISBN 搜索",
      citationWebsiteUrl:"网页网址或搜索词",
      citationWebsiteUrlPlaceholder:"粘贴网址，或按标题、作者或主题搜索",
      citationFindSource:"搜索资料",
      citationFindingSource:"正在搜索公共引用元数据…",
      citationLookupNote:"粘贴的网址会被直接核对；关键词搜索使用 Crossref 免费公共学术元数据。选择结果后，ConCourse 会先验证再导入。请核对所有字段。",
      citationLookupRequired:"请先输入网页网址或搜索词。",
      citationLookupInvalid:"请输入至少两个字符，或使用完整且公开的 http(s) 网页网址。",
      citationLookupSuccess:"已找到资料详情。请核对并修正下方导入字段。",
      citationLookupPartial:"已找到部分资料。使用引用前，请补全下方缺失字段。",
      citationLookupFailed:"ConCourse 无法读取此网页。你仍可在下方手动输入资料。",
      citationLookupUnavailable:"自动查找暂时不可用，请在下方手动输入资料。",
      citationLookupRateLimited:"你在短时间内进行了多次查找。请等待一分钟后再试。",
      citationLookupDailyLimited:"你已达到今天的资料搜索限额。请明天再试、粘贴精确网址，或手动输入资料。",
      citationLookupSessionExpired:"登录状态已过期。请重新登录后使用自动查找。",
      citationLookupUnsupported:"此网页无法自动读取，请在下方手动输入资料。",
      citationLookupTimedOut:"所选网页响应时间过长，引用资料未作任何更改。请重试或手动输入资料。",
      citationLookupSignIn:"请先登录，再使用网页自动查找。",
      citationLookupReplaceConfirm:"查找新资料将替换当前网页草稿及已编辑引用。是否继续？",
      citationSearchResultsTitle:"选择正确的资料",
      citationSearchResultCount:"找到 {count} 个结果",
      citationSearchNoResults:"未找到匹配资料。请尝试更具体的标题、作者或网址，或手动输入资料。",
      citationSearchExactOnly:"已找到该精确网页。请选择并导入，再核对其资料。",
      citationSearchUnavailable:"学术关键词搜索暂时不可用。请粘贴完整公开网址进行精确查找，或手动输入资料。",
      citationSearchReview:"选择前，请比较标题、作者、网站、日期和网址。",
      citationSelectSource:"选择资料",
      citationSelectingSource:"正在核对所选网页…",
      citationResultUnknownAuthor:"未列出作者",
      citationResultExact:"网址完全匹配",
      citationSearchAttribution:"学术元数据由 Crossref 提供",
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
      citationLocatorPlaceholder:"10.1000/182 或 https://…",
      citationPinpoint:"所引页码或定位信息",
      citationPinpointPlaceholder:"42、115–117 或 sec. 3",
      citationClear:"清空字段",
      citationPreviewEyebrow:"实时结果",
      citationPreviewTitle:"你的参考文献",
      citationReferenceLabel:"可编辑的参考文献条目",
      citationInlineLabel:"文内引用",
      citationNoteLabel:"简短脚注",
      citationPreviewPlaceholder:"输入标题以生成参考文献，或直接在此输入。",
      citationInlinePlaceholder:"文内引用将在这里显示。",
      citationEdited:"已编辑",
      citationEditHint:"你可以直接在此框中修正生成的参考文献。",
      citationRestore:"恢复生成版本",
      citationRestored:"已恢复生成的参考文献。",
      citationEditedStatus:"复制或保存时将使用你编辑后的参考文献。",
      citationEditedSourceChanged:"资料详情已改变。编辑后的参考文献会保留，直至你恢复生成版本。",
      citationCopy:"复制引用",
      citationAdd:"加入参考书目",
      citationReady:"引用已更新。",
      citationCopied:"已复制带格式的引用。",
      citationCopiedPlain:"已复制纯文本引用。",
      citationCopyFailed:"复制失败，请手动选择并复制引用。",
      citationAdded:"已加入本项目参考书目。",
      citationUpdated:"已更新保存的参考文献。",
      citationDuplicate:"该资料已在参考书目中。",
      citationMissingTitle:"请输入资料标题以生成引用。",
      citationInvalidYear:"请输入四位年份，或留空表示无日期。",
      citationInvalidUrl:"请输入完整的 http(s) 网址，或以 10. 开头的 DOI。",
      citationInvalidDate:"请输入有效的发布日期，或留空。",
      citationReferenceLimit:"参考文献最多可包含 5,000 个字符，超出内容已移除。",
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
      toolsLocalNote:"手動輸入同已儲存嘅參考書目只會留喺呢部裝置。學術關鍵字結果使用 Crossref 免費公共元資料；所選網頁由 ConCourse 核對。",
      citationStyleLegend:"引用格式",
      sourceTypeLegend:"資料類型",
      sourceBook:"書籍",
      sourceJournal:"期刊文章",
      sourceWebsite:"網頁",
      citationEntryModeLegend:"加入呢個網頁",
      citationAutomaticMode:"自動搵資料",
      citationAutomaticModeHint:"貼上任何公開網址，或者按標題、作者、DOI 或 ISBN 搜尋學術資料。",
      citationManualMode:"手動輸入",
      citationManualModeHint:"自行填寫每一項資料詳情。",
      citationSearchLabel:"網頁網址或者搜尋字詞",
      citationSearchPlaceholder:"貼上網址，或者按標題、作者、DOI 或 ISBN 搜尋",
      citationWebsiteUrl:"網頁網址或者搜尋字詞",
      citationWebsiteUrlPlaceholder:"貼上網址，或者按標題、作者或主題搜尋",
      citationFindSource:"搜尋資料",
      citationFindingSource:"正在搜尋公共引用元資料…",
      citationLookupNote:"貼上嘅網址會直接核對；關鍵字搜尋使用 Crossref 免費公共學術元資料。揀選結果之後，ConCourse 會先驗證再匯入。請核對所有欄位。",
      citationLookupRequired:"請先輸入網頁網址或者搜尋字詞。",
      citationLookupInvalid:"請輸入至少兩個字元，或者使用完整而且公開嘅 http(s) 網頁網址。",
      citationLookupSuccess:"已經搵到資料詳情。請核對同修正下面匯入嘅欄位。",
      citationLookupPartial:"已經搵到部分資料。使用引用之前，請補齊下面欠缺嘅欄位。",
      citationLookupFailed:"ConCourse 未能讀取呢個網頁。你仍然可以喺下面手動輸入資料。",
      citationLookupUnavailable:"自動查找暫時用唔到，請喺下面手動輸入資料。",
      citationLookupRateLimited:"你在短時間內進行了多次搜尋。請等候一分鐘後再試。",
      citationLookupDailyLimited:"你已用完今天的來源搜尋限額。請明天再試、貼上確切網址，或手動輸入來源資料。",
      citationLookupSessionExpired:"登入狀態已過期。請重新登入先使用自動查找。",
      citationLookupUnsupported:"呢個網頁未能自動讀取，請喺下面手動輸入資料。",
      citationLookupTimedOut:"所選網頁回應時間過長，引用資料冇任何更改。請再試一次或者手動輸入資料。",
      citationLookupSignIn:"請先登入，再使用網頁自動查找。",
      citationLookupReplaceConfirm:"搵新資料會取代目前網頁草稿同已編輯引用。係咪繼續？",
      citationSearchResultsTitle:"揀選正確資料",
      citationSearchResultCount:"搵到 {count} 個結果",
      citationSearchNoResults:"搵唔到相符資料。請試更具體嘅標題、作者或網址，或者手動輸入資料。",
      citationSearchExactOnly:"已經搵到該精確網頁。請揀選並匯入，再核對資料。",
      citationSearchUnavailable:"學術關鍵字搜尋暫時用唔到。請貼上完整公開網址作精確查找，或者手動輸入資料。",
      citationSearchReview:"揀選之前，請比較標題、作者、網站、日期同網址。",
      citationSelectSource:"揀選資料",
      citationSelectingSource:"正在核對所選網頁…",
      citationResultUnknownAuthor:"未列出作者",
      citationResultExact:"網址完全相符",
      citationSearchAttribution:"學術元資料由 Crossref 提供",
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
      citationLocatorPlaceholder:"10.1000/182 或 https://…",
      citationPinpoint:"引用頁碼或定位資料",
      citationPinpointPlaceholder:"42、115–117 或 sec. 3",
      citationClear:"清空欄位",
      citationPreviewEyebrow:"即時結果",
      citationPreviewTitle:"你嘅參考文獻",
      citationReferenceLabel:"可編輯嘅參考文獻條目",
      citationInlineLabel:"文內引用",
      citationNoteLabel:"簡短註腳",
      citationPreviewPlaceholder:"輸入標題以產生參考文獻，或者直接喺呢度輸入。",
      citationInlinePlaceholder:"文內引用會喺呢度顯示。",
      citationEdited:"已編輯",
      citationEditHint:"你可以直接喺呢個框修正產生嘅參考文獻。",
      citationRestore:"還原產生版本",
      citationRestored:"已還原產生嘅參考文獻。",
      citationEditedStatus:"複製或者儲存時會使用你編輯後嘅參考文獻。",
      citationEditedSourceChanged:"資料詳情已經改變。編輯後嘅參考文獻會保留，直至你還原產生版本。",
      citationCopy:"複製引用",
      citationAdd:"加入參考書目",
      citationReady:"引用已更新。",
      citationCopied:"已複製帶格式引用。",
      citationCopiedPlain:"已複製純文字引用。",
      citationCopyFailed:"複製失敗，請手動揀選同複製引用。",
      citationAdded:"已加入呢個項目嘅參考書目。",
      citationUpdated:"已更新儲存嘅參考文獻。",
      citationDuplicate:"呢份資料已經喺參考書目入面。",
      citationMissingTitle:"請輸入資料標題嚟產生引用。",
      citationInvalidYear:"請輸入四位年份，或者留空代表冇日期。",
      citationInvalidUrl:"請輸入完整 http(s) 網址，或者以 10. 開頭嘅 DOI。",
      citationInvalidDate:"請輸入有效嘅發佈日期，或者留空。",
      citationReferenceLimit:"參考文獻最多可以有 5,000 個字元，超出內容已移除。",
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

  const ACADEMIC_COPY_REFINEMENTS = Object.freeze({
    en: Object.freeze({
      citationExampleEyebrow:"Quick start",
      citationExampleTitle:"See a polished reference take shape",
      citationExampleText:"Choose a source type below, then change any field to see the reference and in-text citation update.",
      citationExampleNotSaved:"Nothing is added to your bibliography until you choose Add.",
      citationExampleWebsite:"Website",
      citationExampleJournal:"Journal",
      citationExampleBook:"Book",
      citationExampleLoaded:"Source loaded. Edit any field or add the finished reference when you are ready.",
      citationExampleImageAlt:"A library desk with an open research book, laptop and source notes."
    }),
    "zh-CN": Object.freeze({
      citationExampleEyebrow:"快速开始",
      citationExampleTitle:"查看规范参考文献如何生成",
      citationExampleText:"选择下方的来源类型，再修改任意字段，查看参考文献和文内引用实时更新。",
      citationExampleNotSaved:"点击“加入参考书目”后，来源才会保存。",
      citationExampleWebsite:"网页",
      citationExampleJournal:"期刊",
      citationExampleBook:"书籍",
      citationExampleLoaded:"来源已载入。你可以修改字段，确认后再加入参考书目。",
      citationExampleImageAlt:"图书馆书桌上摆有研究书籍、手提电脑和来源笔记。",
      toolsWorkspaceTitle:"参考文献工作室",
      toolsWorkspaceIntro:"生成规范的参考文献、核对文内引用，并整理当前项目的参考书目。",
      toolsLocalNote:"手动输入的来源与已保存的参考书目只保存在此设备。学术关键词结果来自 Crossref 免费公开元数据；所选网页会由 ConCourse 核对。",
      sourceTypeLegend:"来源类型",
      citationEntryModeLegend:"添加网页来源",
      citationAutomaticMode:"自动检索",
      citationAutomaticModeHint:"粘贴公开网址，或按标题、作者、DOI 或 ISBN 检索学术来源。",
      citationManualModeHint:"自行填写每一项来源信息。",
      citationSearchLabel:"网页网址或检索词",
      citationSearchPlaceholder:"粘贴网址，或按标题、作者、DOI 或 ISBN 检索",
      citationWebsiteUrl:"网页网址或检索词",
      citationWebsiteUrlPlaceholder:"粘贴网址，或按标题、作者或主题检索",
      citationFindSource:"搜索来源",
      citationFindingSource:"正在搜索公开文献元数据…",
      citationLookupNote:"系统会直接核对粘贴的网址；关键词搜索使用 Crossref 免费公开学术元数据。选择结果后，ConCourse 会先核对再导入。请检查每个字段。",
      citationLookupSuccess:"已找到来源信息。请检查并修正下方导入的字段。",
      citationLookupPartial:"已找到部分来源信息。使用参考文献前，请补全下方缺失字段。",
      citationLookupFailed:"ConCourse 无法读取该网页。你仍可在下方手动输入来源信息。",
      citationLookupUnavailable:"自动检索暂时不可用，请在下方手动输入来源信息。",
      citationSearchResultsTitle:"选择正确的来源",
      citationSearchNoResults:"未找到匹配的来源。请尝试更具体的标题、作者或网址，或手动输入来源信息。",
      citationSearchReview:"选择前，请核对标题、作者、网站、日期和网址。",
      citationSelectSource:"选择此来源",
      citationDetailsLegend:"来源信息",
      citationAuthorType:"作者类型",
      citationAuthors:"作者或机构名称",
      citationAuthorsHint:"多位作者请用分号分隔；使用“姓, 名”格式最能确保姓名顺序正确。",
      citationTitlePlaceholder:"请按原文准确输入来源标题",
      citationPublicationDate:"出版或发布日期",
      citationAccessDate:"检索日期",
      citationEdition:"版次",
      citationPinpoint:"引用页码或具体位置",
      citationPinpointPlaceholder:"42、115–117 或第 3 节",
      citationPreviewEyebrow:"实时预览",
      citationPreviewTitle:"参考文献预览",
      citationReferenceLabel:"可编辑的参考文献条目",
      citationNoteLabel:"简式脚注",
      citationPreviewPlaceholder:"输入标题以生成参考文献，或直接在此输入。",
      citationCopy:"复制参考文献",
      citationReady:"参考文献已更新。",
      citationCopied:"已复制带格式的参考文献。",
      citationCopiedPlain:"已复制纯文本参考文献。",
      citationCopyFailed:"复制失败，请手动选择并复制参考文献。",
      citationMissingTitle:"请输入来源标题以生成参考文献。",
      citationBookPublisherWarning:"请补充出版社，以生成完整的书籍参考文献。",
      citationJournalWarning:"请补充期刊名称，以生成完整的文章参考文献。",
      citationWebsiteWarning:"请补充网址，以生成完整的网页参考文献。",
      styleApaAdvice:"APA 第 7 版 · 常用于社会科学与商科。提交前请检查句首字母大写规则与斜体格式。",
      styleMlaAdvice:"MLA 第 9 版 · 常用于人文学科。请检查标题大小写及课程要求的收录来源信息。"
    }),
    "zh-HK": Object.freeze({
      citationExampleEyebrow:"快速開始",
      citationExampleTitle:"查看完整參考文獻如何建立",
      citationExampleText:"選擇下方嘅來源類型，再修改任何欄位，查看參考文獻同文內引用即時更新。",
      citationExampleNotSaved:"按下「加入參考書目」後，來源先會儲存。",
      citationExampleWebsite:"網頁",
      citationExampleJournal:"期刊",
      citationExampleBook:"書籍",
      citationExampleLoaded:"來源已載入。你可以修改欄位，確認後再加入參考書目。",
      citationExampleImageAlt:"圖書館書桌上放有研究書籍、手提電腦和來源筆記。",
      toolsWorkspaceTitle:"參考文獻工作室",
      toolsWorkspaceIntro:"建立格式規範的參考文獻、查看文內引用，並整理目前項目的參考書目。",
      toolsLocalNote:"手動輸入的資料和已儲存的參考書目只會保留在此裝置。學術關鍵字搜尋結果來自 Crossref 的免費公開中繼資料；所選網頁會由 ConCourse 核對。",
      sourceTypeLegend:"來源類型",
      citationEntryModeLegend:"加入此網頁資料",
      citationAutomaticMode:"自動搜尋",
      citationAutomaticModeHint:"貼上任何公開網址，或按標題、作者、DOI 或 ISBN 搜尋學術資料。",
      citationManualModeHint:"自行填寫每項來源資料。",
      citationSearchLabel:"網頁網址或搜尋字詞",
      citationSearchPlaceholder:"貼上網址，或按標題、作者、DOI 或 ISBN 搜尋",
      citationWebsiteUrl:"網頁網址或搜尋字詞",
      citationWebsiteUrlPlaceholder:"貼上網址，或按標題、作者或主題搜尋",
      citationFindSource:"搜尋來源",
      citationFindingSource:"正在搜尋公開引用資料…",
      citationLookupNote:"系統會直接核對貼上的網址；關鍵字搜尋則使用 Crossref 的免費公開學術中繼資料。選擇結果後，ConCourse 會先核對再匯入。請檢查每個欄位。",
      citationLookupRequired:"請先輸入網頁網址或搜尋字詞。",
      citationLookupInvalid:"請輸入最少兩個字元，或使用完整且公開的 http(s) 網頁網址。",
      citationLookupSuccess:"已找到來源資料。請核對並修正下方匯入的欄位。",
      citationLookupPartial:"已找到部分來源資料。使用參考文獻前，請補充下方欠缺的欄位。",
      citationLookupFailed:"ConCourse 無法讀取此網頁。你仍可在下方手動輸入來源資料。",
      citationLookupUnavailable:"自動搜尋暫時無法使用，請在下方手動輸入來源資料。",
      citationLookupSessionExpired:"登入狀態已過期。請重新登入後再使用自動搜尋。",
      citationLookupUnsupported:"此網頁無法自動讀取，請在下方手動輸入來源資料。",
      citationLookupTimedOut:"所選網頁的回應時間過長。引用資料並未更改；請再試或手動輸入來源資料。",
      citationLookupSignIn:"請先登入，再使用網頁自動搜尋。",
      citationLookupReplaceConfirm:"搜尋新的來源會取代目前的網頁草稿和已編輯參考文獻。是否繼續？",
      citationSearchResultsTitle:"選擇正確的來源",
      citationSearchResultCount:"找到 {count} 個結果",
      citationSearchNoResults:"找不到相符的來源。請嘗試使用更具體的標題、作者或網址，或手動輸入來源資料。",
      citationSearchExactOnly:"已找到與網址完全相符的網頁。請選擇並匯入，再核對其資料。",
      citationSearchUnavailable:"學術關鍵字搜尋暫時無法使用。請貼上完整的公開網址作精確搜尋，或手動輸入來源資料。",
      citationSearchReview:"選擇來源前，請比較標題、作者、網站、日期和網址。",
      citationSelectSource:"選擇來源",
      citationSelectingSource:"正在核對所選網頁…",
      citationResultExact:"網址完全相符",
      citationDetailsLegend:"來源資料",
      citationAuthorType:"作者類型",
      citationAuthors:"作者或機構",
      citationAuthorsHint:"多位作者請以分號分隔；使用「姓, 名」格式最能確保姓名次序正確。",
      citationTitlePlaceholder:"按照出版資料輸入完整標題",
      citationPublicationDate:"出版日期",
      citationAccessDate:"查閱日期",
      citationEdition:"版次",
      citationPinpoint:"指定頁碼或段落",
      citationPinpointPlaceholder:"42、115–117 或第 3 節",
      citationClear:"清除欄位",
      citationPreviewEyebrow:"即時預覽",
      citationPreviewTitle:"參考文獻預覽",
      citationReferenceLabel:"可編輯的參考文獻條目",
      citationNoteLabel:"簡短註釋",
      citationPreviewPlaceholder:"輸入標題以建立參考文獻，或直接在此輸入。",
      citationInlinePlaceholder:"文內引用會在此顯示。",
      citationEditHint:"你可以直接在此欄修正生成的參考文獻。",
      citationRestore:"還原生成版本",
      citationRestored:"已還原生成的參考文獻。",
      citationEditedStatus:"複製或儲存時，系統會使用你編輯後的參考文獻。",
      citationEditedSourceChanged:"來源資料已更改。你編輯的參考文獻會保留，直至還原生成版本。",
      citationCopy:"複製參考文獻",
      citationReady:"參考文獻已更新。",
      citationCopied:"已複製包含格式的參考文獻。",
      citationCopiedPlain:"已複製純文字參考文獻。",
      citationCopyFailed:"複製失敗。請手動選擇並複製參考文獻。",
      citationAdded:"已加入目前項目的參考書目。",
      citationUpdated:"已更新儲存的參考文獻。",
      citationDuplicate:"此來源已在參考書目中。",
      citationMissingTitle:"請加入來源標題以建立參考文獻。",
      citationInvalidYear:"請輸入四位數字的出版年份，或留空表示沒有日期。",
      citationInvalidUrl:"請輸入完整的 http(s) 網址，或以 10. 開頭的 DOI。",
      citationInvalidDate:"請輸入有效的出版日期，或留空。",
      citationBookPublisherWarning:"請加入出版社資料，以建立完整的書籍參考文獻。",
      citationJournalWarning:"請加入期刊名稱，以建立完整的文章參考文獻。",
      citationWebsiteWarning:"請加入網址，以建立完整的網頁參考文獻。",
      citationAuthorWarning:"尚未輸入作者；參考文獻將由標題開始。",
      bibliographyIntro:"參考書目會儲存在此裝置，並在你切換引用格式時自動重新排版。",
      bibliographyCount:"已儲存 {count} 項",
      bibliographyEmpty:"已儲存的參考文獻會在此顯示。",
      bibliographyCopied:"已複製包含格式的參考書目。",
      bibliographyStorageFailed:"此瀏覽器無法儲存參考書目。請檢查儲存設定後再試。",
      bibliographyClearConfirm:"確定要移除此裝置上所有已儲存的參考文獻？",
      styleApaUse:"心理學、教育、社會科學及不少商科課程。",
      styleMlaUse:"文學、語言、藝術及其他人文學科。",
      styleChicagoUse:"歷史及出版；此工具會建立 Chicago 17 參考書目條目和簡短註釋。",
      styleHarvardUse:"廣泛用於不同大學和學科；各校的 Harvard 規則可能有所不同。",
      styleApaAdvice:"APA 第 7 版 · 常用於社會科學及商科。提交前請檢查句首字母大小寫（sentence case）及斜體格式。",
      styleMlaAdvice:"MLA 第 9 版 · 常用於人文學科。請檢查標題式大小寫（title case），以及課程要求的收錄來源資料。",
      styleChicagoAdvice:"Chicago 第 17 版 · 註釋與參考書目格式。Chicago 第 18 版的指引有所不同，請按照導師指定的版本。",
      styleHarvardAdvice:"Harvard · 採用類似 Cite Them Right 的作者—日期格式；不同大學通常會有本校版本。",
      styleIeeeAdvice:"IEEE · 常用於工程及電腦科學。參考文獻會按加入次序編號。",
      citationDisclaimer:"生成的參考文獻只供初步參考。提交前請務必核對課程、期刊或院校的格式指引。",
      citationFormattingNote:"標題的大小寫規則可能因語言和專有名詞而異；生成器會保留你輸入的標題。",
      citationStyleEngine:"支援 APA 7、MLA 9、Chicago 17、Harvard 作者—日期格式及 IEEE。"
    })
  });

  const state = {
    library:[],
    storageKey:"",
    preview:null,
    previewTimer:null,
    initialized:false,
    draftOverrides:Object.create(null),
    overrideBaseFingerprints:Object.create(null),
    lookupRequest:0,
    lookupBusy:false,
    lookupAbortController:null,
    lookupMode:"search",
    searchQuery:"",
    searchProvider:"",
    searchResults:[]
  };

  const byId = id => document.getElementById(id);
  const replaceVariables = (value, variables={}) => String(value).replace(/\{(\w+)\}/g, (_match, key) => String(variables[key] ?? ""));
  const language = () => {
    const candidate = typeof currentLanguage === "string" ? currentLanguage : document.documentElement.lang;
    return COPY[candidate] ? candidate : "en";
  };
  const tr = (key, variables={}) => {
    const current = language();
    return replaceVariables(
      ACADEMIC_COPY_REFINEMENTS[current]?.[key] || COPY[current]?.[key] || COPY.en[key] || key,
      variables
    );
  };
  const clean = value => String(value || "").normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  const cleanReference = value => String(value || "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_REFERENCE_LENGTH);
  const escapeHtml = value => clean(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
  const referenceTextHtml = value => cleanReference(value)
    .replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]))
    .replace(/\n/g, "<br>");
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
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
    if(authors.length > 3) return `${authorLastInitial(authors[0])} et al.`;
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
    const enteredYear = clean(byId("citationYear")?.value);
    return {
      id:crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      source:SOURCE_VALUES.has(source) ? source : "book",
      authors:parseAuthors(byId("citationAuthors")?.value, byId("citationAuthorType")?.value || "person"),
      title:clean(byId("citationTitle")?.value),
      year:source === "website" ? String(dateParts(publicationDate)?.year || enteredYear) : enteredYear,
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
    if(record.publicationDate && !dateParts(record.publicationDate)) errors.push("citationInvalidDate");
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
    if(style === "mla" && locator.kind === "url") return locator.value.replace(/^https?:\/\//iu, "");
    return locator.kind === "doi" ? locator.url : locator.value;
  };

  function formatApa(record){
    const author = apaAuthors(record.authors);
    const year = record.year ? `${record.year}${record.yearSuffix || ""}` : `n.d.${record.yearSuffix ? `-${record.yearSuffix}` : ""}`;
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
    const datedLead = author ? `${sentence(author)} (${date || year}).` : `(${date || year}).`;
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
    const year = record.year ? `${record.year}${record.yearSuffix || ""}` : `no date${record.yearSuffix ? ` ${record.yearSuffix}` : ""}`;
    const lead = `${author ? `${author} ` : ""}(${year})`;
    const locator = locatorFor(record, "harvard");
    const edition = ordinalEdition(record.edition);
    const available = locator ? `Available at: ${locator}` : "";
    const accessed = dateDayFirst(record.accessDate);
    if(record.source === "book"){
      const publication = record.publisher ? `${record.publisherPlace ? `${record.publisherPlace}: ` : ""}${record.publisher}` : record.publisherPlace;
      if(!author) return joinWords(withPeriod(italicPair(record.title)), pair(`(${year})`), edition ? pair(`${edition} edn.`) : pair(), publication ? pair(sentence(publication)) : pair(), available ? pair(`${available}${accessed && locatorInfo(record.locator).kind === "url" ? ` (Accessed: ${accessed})` : ""}.`) : pair());
      return joinWords(pair(lead), withPeriod(italicPair(record.title)), edition ? pair(`${edition} edn.`) : pair(), publication ? pair(sentence(publication)) : pair(), available ? pair(`${available}${accessed && locatorInfo(record.locator).kind === "url" ? ` (Accessed: ${accessed})` : ""}.`) : pair());
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

  function shortenedTitle(value, wordLimit=4){
    const words = stripTerminal(value).split(/\s+/u).filter(Boolean);
    return words.length > wordLimit ? words.slice(0, wordLimit).join(" ") : words.join(" ");
  }

  function titleForParenthetical(record){
    const title = shortenedTitle(record.title);
    return record.source === "book" ? title : quoted(title);
  }

  function chicagoShortAuthors(authors){
    const families = authors.map(authorFamily).filter(Boolean);
    if(families.length <= 3) return serialJoin(families, "and", true);
    return `${families[0]} et al.`;
  }

  function inTextCitation(record, style, sequence=1){
    const family = record.authors.map(authorFamily).filter(Boolean);
    const year = record.year ? `${record.year}${record.yearSuffix || ""}` : `n.d.${record.yearSuffix ? `-${record.yearSuffix}` : ""}`;
    const pinpoint = clean(record.pinpoint);
    const pageLabel = pinpoint && /^\d/u.test(pinpoint) ? (/[–—,-]/u.test(pinpoint) ? "pp." : "p.") : "";
    if(style === "ieee") return pinpoint ? `[${sequence}, ${pageLabel ? `${pageLabel} ` : ""}${pinpoint}]` : `[${sequence}]`;
    if(style === "mla"){
      const author = family.length ? `${family[0]}${family.length === 2 ? ` and ${family[1]}` : family.length > 2 ? " et al." : ""}` : titleForParenthetical(record);
      return `(${author}${pinpoint ? ` ${pinpoint}` : ""})`;
    }
    if(style === "chicago"){
      const author = chicagoShortAuthors(record.authors);
      const shortTitle = shortenedTitle(record.title);
      const title = record.source === "book" ? shortTitle : quotedTerminalPair(shortTitle, pinpoint ? "," : ".").plain;
      const lead = author ? `${author}, ${title}` : title;
      if(!pinpoint) return record.source === "book" ? `${lead}.` : lead;
      return `${lead}${record.source === "book" ? "," : ""} ${pinpoint}.`;
    }
    if(style === "harvard"){
      const author = !family.length ? titleForParenthetical(record) : family.length === 1 ? family[0] : family.length <= 3 ? serialJoin(family, "and", false) : `${family[0]} et al.`;
      const harvardYear = record.year ? `${record.year}${record.yearSuffix || ""}` : `no date${record.yearSuffix ? ` ${record.yearSuffix}` : ""}`;
      return `(${author}, ${harvardYear}${pinpoint ? `, ${pageLabel ? `${pageLabel} ` : ""}${pinpoint}` : ""})`;
    }
    const author = !family.length ? titleForParenthetical(record) : family.length === 1 ? family[0] : family.length === 2 ? `${family[0]} & ${family[1]}` : `${family[0]} et al.`;
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

  function effectiveFormat(record, style=selectedStyle(), sequence=1){
    const generated = formatRecord(record, style, sequence);
    const override = cleanReference(record.referenceOverrides?.[style]);
    return override
      ? {...generated, plain:override, html:referenceTextHtml(override), custom:true}
      : {...generated, custom:false};
  }

  function currentUserId(){
    try { return typeof currentUser !== "undefined" ? currentUser?.id || "local" : "local"; }
    catch(_error){ return "local"; }
  }

  const RECORD_STRING_FIELDS = ["title", "year", "publicationDate", "accessDate", "publisher", "publisherPlace", "edition", "containerTitle", "volume", "issue", "pages", "pinpoint", "locator"];

  function sourceFingerprint(record){
    return JSON.stringify([
      record.source,
      record.authors.map(author => author.kind === "organization" ? ["organization", clean(author.literal)] : ["person", clean(author.family), clean(author.given)]),
      ...RECORD_STRING_FIELDS.map(field => clean(record[field]))
    ]);
  }

  function normalizeRecord(item, index=0){
    if(!item || !SOURCE_VALUES.has(item.source)) return null;
    const record = {id:clean(item.id) || `saved-${index}`, source:item.source, authors:[]};
    record.authors = Array.isArray(item.authors) ? item.authors.map(author => {
      if(author?.kind === "organization" && clean(author.literal)) return {kind:"organization", literal:clean(author.literal)};
      if(author?.kind === "person" && (clean(author.family) || clean(author.given))) return {kind:"person", family:clean(author.family), given:clean(author.given)};
      return null;
    }).filter(Boolean) : [];
    RECORD_STRING_FIELDS.forEach(field => { record[field] = clean(item[field]); });
    record.referenceOverrides = {};
    STYLE_VALUES.forEach(style => {
      const override = cleanReference(item.referenceOverrides?.[style]);
      if(override) record.referenceOverrides[style] = override;
    });
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

  function setLookupStatus(message="", kind=""){
    const target = byId("citationLookupStatus");
    if(!target) return;
    target.textContent = message;
    target.className = `citation-lookup-status${kind ? ` ${kind}` : ""}`;
    const input = byId("citationAutomaticUrl");
    if(input){
      if(kind === "error") input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  function updateReferenceEditUi(custom=false){
    const badge = byId("citationEditedBadge");
    const restore = byId("restoreCitation");
    if(badge) badge.hidden = !custom;
    if(restore) restore.hidden = !custom;
  }

  function setPreviewPlaceholder(){
    const reference = byId("citationOutput");
    const inline = byId("citationInlineOutput");
    if(reference){
      reference.className = "citation-render citation-editable-reference is-placeholder";
      reference.replaceChildren();
      reference.dataset.placeholder = tr("citationPreviewPlaceholder");
    }
    if(inline){ inline.className = "citation-inline-render is-placeholder"; inline.textContent = tr("citationInlinePlaceholder"); }
    updateReferenceEditUi(false);
    state.preview = null;
    byId("copyCitation") && (byId("copyCitation").disabled = true);
    byId("addCitation") && (byId("addCitation").disabled = true);
  }

  function renderPreview({announce=false}={}){
    const record = recordFromForm();
    const style = selectedStyle();
    const validation = validateRecord(record);
    const hasOverride = owns(state.draftOverrides, style);
    const override = hasOverride ? cleanReference(state.draftOverrides[style]) : "";
    byId("citationPreviewStyle").textContent = document.querySelector('input[name="citationStyle"]:checked + span')?.textContent || "APA 7";
    byId("citationSecondaryLabel").textContent = tr(style === "chicago" ? "citationNoteLabel" : "citationInlineLabel");
    if(!record.title && !hasOverride){
      setPreviewPlaceholder();
      const hasOtherDetails = !!(record.authors.length || record.year || record.publisher || record.containerTitle || record.locator);
      setStatus(hasOtherDetails ? tr("citationMissingTitle") : "", hasOtherDetails ? "error" : "", announce && hasOtherDetails);
      return;
    }
    if(validation.errors.length && !hasOverride){
      setPreviewPlaceholder();
      setStatus(tr(validation.errors[0]), "error", announce);
      return;
    }
    const generated = record.title && !validation.errors.length ? formatRecord(record, style, 1) : null;
    const formatted = hasOverride
      ? {plain:override, html:referenceTextHtml(override), inline:generated?.inline || "", custom:true}
      : {...generated, custom:false};
    const reference = byId("citationOutput");
    const inline = byId("citationInlineOutput");
    reference.className = `citation-render citation-editable-reference${formatted.plain ? "" : " is-placeholder"}${hasOverride ? " is-edited" : ""}`;
    reference.dataset.placeholder = tr("citationPreviewPlaceholder");
    if(hasOverride) reference.textContent = formatted.plain;
    else reference.innerHTML = `<div class="csl-bib-body"><div class="csl-entry">${formatted.html}</div></div>`;
    if(generated){
      inline.className = "citation-inline-render";
      inline.textContent = generated.inline;
    } else {
      inline.className = "citation-inline-render is-placeholder";
      inline.textContent = tr("citationInlinePlaceholder");
    }
    updateReferenceEditUi(hasOverride);
    state.preview = {record, style, generated, ...formatted};
    byId("copyCitation").disabled = !formatted.plain;
    byId("addCitation").disabled = !formatted.plain || !record.title || validation.errors.length > 0;
    if(validation.errors.length){
      setStatus(tr(validation.errors[0]), "error", announce);
    } else if(hasOverride){
      const changed = state.overrideBaseFingerprints[style] && state.overrideBaseFingerprints[style] !== sourceFingerprint(record);
      setStatus(tr(changed ? "citationEditedSourceChanged" : "citationEditedStatus"), "edited", announce);
    } else {
      setStatus(validation.warnings.length ? tr(validation.warnings[0]) : tr("citationReady"), validation.warnings.length ? "" : "success", announce);
    }
  }

  function schedulePreview(){
    if(state.previewTimer) clearTimeout(state.previewTimer);
    state.previewTimer = window.setTimeout(() => { state.previewTimer = null; renderPreview(); }, 120);
  }

  function flushPreview(){
    if(state.previewTimer){
      clearTimeout(state.previewTimer);
      state.previewTimer = null;
    }
    renderPreview();
  }

  function syncSourceFields({render=true}={}){
    const source = document.querySelector('input[name="citationSource"]:checked')?.value || "book";
    const form = byId("citationForm");
    form?.querySelectorAll("[data-citation-sources]").forEach(field => {
      const sources = field.dataset.citationSources.split(/\s+/u);
      field.hidden = !sources.includes(source);
      field.querySelectorAll("input, select, textarea, button").forEach(control => { control.disabled = field.hidden; });
    });
    syncEntryMode();
    if(render) schedulePreview();
  }

  function syncEntryMode(){
    const isWebsite = document.querySelector('input[name="citationSource"]:checked')?.value === "website";
    const automatic = document.querySelector('input[name="citationEntryMode"]:checked')?.value !== "manual";
    const active = isWebsite && automatic;
    const panel = byId("citationAutomaticPanel");
    if(panel) panel.hidden = !active;
    if(!active) cancelLookup({clearStatus:true, clearResults:true});
  }

  function syncStyle({render=true}={}){
    const style = selectedStyle();
    byId("citationStyleAdvice").textContent = tr(`style${style[0].toLocaleUpperCase()}${style.slice(1)}Advice`);
    if(render) renderPreview();
    renderLibrary();
  }

  function fingerprint(record){
    const identity = value => clean(value).toLocaleLowerCase();
    const locator = locatorInfo(record.locator);
    return JSON.stringify([
      record.source,
      identity(record.title),
      identity(record.year),
      identity(record.publicationDate),
      record.authors.map(author => author.kind === "organization"
        ? ["organization", identity(author.literal)]
        : ["person", identity(author.family), identity(author.given)]),
      identity(record.publisher),
      identity(record.publisherPlace),
      identity(record.edition),
      identity(record.containerTitle),
      identity(record.volume),
      identity(record.issue),
      identity(record.pages),
      identity(locator.kind === "doi" ? locator.value : locator.value || "")
    ]);
  }

  function addCurrentCitation(){
    flushPreview();
    if(!state.preview) return;
    const validation = validateRecord(state.preview.record);
    if(validation.errors.length){
      setStatus(tr(validation.errors[0]), "error", true);
      return;
    }
    const referenceOverrides = {};
    STYLE_VALUES.forEach(style => {
      if(owns(state.draftOverrides, style)){
        const override = cleanReference(state.draftOverrides[style]);
        if(override) referenceOverrides[style] = override;
      }
    });
    const next = {...state.preview.record, referenceOverrides, id:crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`};
    const key = fingerprint(next);
    const existingIndex = state.library.findIndex(item => fingerprint(item) === key);
    if(existingIndex >= 0){
      const existing = state.library[existingIndex];
      const updated = {
        ...next,
        id:existing.id,
        referenceOverrides:{...(existing.referenceOverrides || {}), ...referenceOverrides}
      };
      if(JSON.stringify(existing) === JSON.stringify(updated)){
        setStatus(tr("citationDuplicate"), "", true);
        return;
      }
      const previous = [...state.library];
      state.library[existingIndex] = updated;
      if(!saveLibrary()){
        state.library = previous;
        setStatus(tr("bibliographyStorageFailed"), "error", true);
        return;
      }
      renderLibrary();
      setStatus(tr("citationUpdated"), "success", true);
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
      if(!record.authors.length) return;
      const key = `${record.authors.map(author => author.kind === "organization" ? clean(author.literal).toLocaleLowerCase() : `${clean(author.family).toLocaleLowerCase()}|${clean(author.given).toLocaleLowerCase()}`).join(";")}::${record.year || "no-date"}`;
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
      const formatted = effectiveFormat(record, selectedStyle(), index + 1);
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
    flushPreview();
    if(!state.preview) return;
    const result = await copyRich(state.preview.plain, `<div style="padding-left:2em;text-indent:-2em">${state.preview.html}</div>`);
    setStatus(tr(result === "rich" ? "citationCopied" : result === "plain" ? "citationCopiedPlain" : "citationCopyFailed"), result === "failed" ? "error" : "success", true);
  }

  async function copyBibliography(){
    const ordered = orderedLibrary();
    if(!ordered.length) return;
    const formatted = ordered.map((record, index) => effectiveFormat(record, selectedStyle(), index + 1));
    const plain = formatted.map(item => item.plain).join("\n\n");
    const html = `<div>${formatted.map(item => `<div style="margin:0 0 1em;padding-left:2em;text-indent:-2em">${item.html}</div>`).join("")}</div>`;
    const result = await copyRich(plain, html);
    setStatus(tr(result === "failed" ? "citationCopyFailed" : "bibliographyCopied"), result === "failed" ? "error" : "success", true);
  }

  function localDateValue(){
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function normalizedWebsiteUrl(value){
    let candidate = clean(value);
    if(!candidate || candidate.length > 2048 || /[\\\u0000-\u001F\u007F]/u.test(candidate)) return "";
    if(!/^[a-z][a-z\d+.-]*:\/\//iu.test(candidate) && /^[\p{L}\p{N}.-]+\.[\p{L}]{2,}(?:[/:?#]|$)/iu.test(candidate)) candidate = `https://${candidate}`;
    try {
      const url = new URL(candidate);
      if(!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
      if(url.port && !["80", "443"].includes(url.port)) return "";
      url.hash = "";
      return url.href;
    } catch(_error){ return ""; }
  }

  function searchInputInfo(value){
    const raw = clean(value);
    const urlIntent = /^[a-z][a-z\d+.-]*:\/\//iu.test(raw)
      || /^[\p{L}\p{N}.-]+\.[\p{L}]{2,}(?:[/:?#]|$)/iu.test(raw);
    if(urlIntent){
      const url = normalizedWebsiteUrl(raw);
      return {query:url || raw, url, kind:"url", valid:!!url};
    }
    const query = raw.replace(/\s+/gu, " ");
    const wordCount = query ? query.split(/\s+/u).length : 0;
    return {query, url:"", kind:"keywords", valid:query.length >= 2 && query.length <= 400 && wordCount <= 50};
  }

  function normalizeSearchResult(value, index=0){
    if(!value || typeof value !== "object") return null;
    const url = normalizedWebsiteUrl(value.url || value.canonicalUrl || value.finalUrl || value.sourceUrl);
    if(!url) return null;
    const authors = Array.isArray(value.authors) ? value.authors.map(author => clean(author).slice(0, 250)).filter(Boolean).slice(0, 20) : [];
    const organization = clean(value.organization).slice(0, 250);
    const publicationDate = dateParts(value.publicationDate) ? clean(value.publicationDate) : "";
    const publicationYear = /^\d{4}$/u.test(clean(value.publicationYear))
      ? clean(value.publicationYear)
      : publicationDate ? publicationDate.slice(0, 4) : "";
    const displayDate = clean(value.displayDate || value.resultDate).replace(/\s+/gu, " ").slice(0, 80);
    let hostname = "";
    try { hostname = new URL(url).hostname.replace(/^www\./iu, ""); } catch(_error){}
    return {
      id:clean(value.id).slice(0, 120) || `source-${index + 1}`,
      url,
      title:clean(value.title).slice(0, 600) || hostname || url,
      description:clean(value.description).slice(0, 1000),
      siteName:clean(value.siteName).slice(0, 250) || hostname,
      authors,
      organization,
      authorType:value.authorType === "organization" && organization ? "organization" : "person",
      publicationDate,
      publicationYear,
      displayDate,
      exactMatch:value.exactMatch === true,
      provider:clean(value.provider).slice(0, 40)
    };
  }

  function clearSearchResults(){
    state.searchQuery = "";
    state.searchProvider = "";
    state.searchResults = [];
    const region = byId("citationSearchResults");
    const list = byId("citationSearchResultsList");
    const loading = byId("citationSearchLoading");
    if(list) list.replaceChildren();
    if(loading) loading.hidden = true;
    if(region) region.hidden = true;
  }

  function resultAuthorLabel(result){
    if(result.authorType === "organization" && result.organization) return result.organization;
    return result.authors.length ? result.authors.join(", ") : result.organization || tr("citationResultUnknownAuthor");
  }

  function visibleResultUrl(value){
    try {
      const url = new URL(value);
      return `${url.hostname.replace(/^www\./iu, "")}${url.pathname === "/" ? "" : url.pathname}${url.search}`.slice(0, 180);
    } catch(_error){ return ""; }
  }

  function renderSearchResults({focus=false}={}){
    const region = byId("citationSearchResults");
    const list = byId("citationSearchResultsList");
    if(!region || !list) return;
    list.replaceChildren();
    const count = state.searchResults.length;
    region.hidden = !count;
    if(!count) return;
    const title = byId("citationSearchResultsTitle");
    const countLabel = byId("citationSearchResultsCount");
    const attribution = byId("citationSearchAttribution");
    if(title) title.textContent = tr("citationSearchResultsTitle");
    if(countLabel) countLabel.textContent = tr("citationSearchResultCount", {count});
    if(attribution){
      attribution.textContent = state.searchProvider.toLocaleLowerCase().includes("crossref") ? tr("citationSearchAttribution") : "";
      attribution.hidden = !attribution.textContent;
    }
    state.searchResults.forEach((result, index) => {
      const item = document.createElement("li");
      item.className = "citation-search-result citation-search-card";
      if(result.exactMatch) item.dataset.exact = "true";

      const body = document.createElement("div");
      body.className = "citation-search-result-body";
      const headingRow = document.createElement("div");
      headingRow.className = "citation-search-result-heading";
      const resultTitle = document.createElement("h4");
      resultTitle.className = "citation-search-title";
      resultTitle.textContent = result.title;
      headingRow.append(resultTitle);
      if(result.exactMatch){
        const badge = document.createElement("span");
        badge.className = "citation-search-result-badge";
        badge.textContent = tr("citationResultExact");
        headingRow.append(badge);
      }
      body.append(headingRow);

      const byline = document.createElement("p");
      byline.className = "citation-search-byline";
      const date = result.displayDate || result.publicationDate || result.publicationYear;
      byline.textContent = [resultAuthorLabel(result), result.siteName, date].filter(Boolean).join(" · ");
      body.append(byline);
      if(result.description){
        const description = document.createElement("p");
        description.className = "citation-search-description";
        description.textContent = result.description;
        body.append(description);
      }
      const url = document.createElement("a");
      url.className = "citation-search-url";
      url.href = result.url;
      url.target = "_blank";
      url.rel = "noopener noreferrer";
      url.textContent = visibleResultUrl(result.url);
      body.append(url);

      const actions = document.createElement("div");
      actions.className = "citation-search-actions";
      const select = document.createElement("button");
      select.type = "button";
      select.className = "academic-tool-button citation-search-result-select";
      select.dataset.citationResultIndex = String(index);
      select.textContent = tr("citationSelectSource");
      select.disabled = state.lookupBusy;
      actions.append(select);
      item.append(body, actions);
      list.append(item);
    });
    if(focus && title){
      title.tabIndex = -1;
      title.focus();
    }
  }

  function setLookupBusy(busy, mode=state.lookupMode){
    state.lookupBusy = busy;
    state.lookupMode = mode;
    byId("citationAutomaticPanel")?.setAttribute("aria-busy", String(busy));
    const region = byId("citationSearchResults");
    const loading = byId("citationSearchLoading");
    if(region) region.setAttribute("aria-busy", String(busy && mode === "search"));
    if(loading) loading.hidden = !(busy && mode === "search");
    if(region && busy && mode === "search") region.hidden = false;
    const button = byId("citationLookupWebsite");
    if(button){
      button.disabled = busy;
      button.textContent = tr(busy ? (mode === "select" ? "citationSelectingSource" : "citationFindingSource") : "citationFindSource");
    }
    byId("citationSearchResultsList")?.querySelectorAll("[data-citation-result-index]").forEach(control => { control.disabled = busy; });
  }

  function cancelLookup({clearStatus=false, clearResults=false}={}){
    state.lookupRequest += 1;
    state.lookupAbortController?.abort();
    state.lookupAbortController = null;
    setLookupBusy(false);
    if(clearStatus) setLookupStatus("");
    if(clearResults) clearSearchResults();
  }

  function websiteDraftHasContent(){
    return ["citationAuthors", "citationTitle", "citationYear", "citationPublicationDate", "citationSite", "citationLocator"]
      .some(id => clean(byId(id)?.value)) || Object.keys(state.draftOverrides).length > 0;
  }

  function applyWebsiteMetadata(metadata, {statusKey="", focus=true}={}){
    const authors = Array.isArray(metadata.authors) ? metadata.authors.map(clean).filter(Boolean).slice(0, 20) : [];
    const organisation = clean(metadata.organization);
    const authorType = metadata.authorType === "person" && authors.length
      ? "person"
      : metadata.authorType === "organization" && organisation
        ? "organization"
        : authors.length ? "person" : organisation ? "organization" : "person";
    byId("citationAuthorType").value = authorType;
    byId("citationAuthors").value = authorType === "organization" ? organisation || authors[0] || "" : authors.join("; ");
    byId("citationTitle").value = clean(metadata.title);
    byId("citationPinpoint").value = "";
    const publicationDate = dateParts(metadata.publicationDate) ? clean(metadata.publicationDate) : "";
    const publicationYear = /^\d{4}$/u.test(clean(metadata.publicationYear))
      ? clean(metadata.publicationYear)
      : publicationDate ? publicationDate.slice(0, 4) : "";
    byId("citationPublicationDate").value = publicationDate;
    byId("citationYear").value = publicationYear;
    byId("citationSite").value = clean(metadata.siteName);
    const resolvedUrl = normalizedWebsiteUrl(metadata.canonicalUrl || metadata.finalUrl || metadata.sourceUrl || metadata.url || byId("citationAutomaticUrl")?.value);
    byId("citationLocator").value = resolvedUrl;
    byId("citationAutomaticUrl").value = resolvedUrl;
    if(!byId("citationAccessDate").value) byId("citationAccessDate").value = localDateValue();
    state.draftOverrides = Object.create(null);
    state.overrideBaseFingerprints = Object.create(null);
    if(state.previewTimer){ clearTimeout(state.previewTimer); state.previewTimer = null; }
    renderPreview({announce:true});
    const partial = !metadata.title || !(organisation || authors.length) || !metadata.siteName || !(publicationDate || publicationYear);
    setLookupStatus(tr(statusKey || (partial ? "citationLookupPartial" : "citationLookupSuccess")), statusKey || partial ? "warning" : "success");
    if(focus) byId("citationTitle")?.focus();
  }

  async function lookupErrorDetails(error){
    const status = Number(error?.context?.status || 0);
    let details = null;
    try {
      const response = error?.context;
      if(response?.clone && typeof response.clone().json === "function") details = await response.clone().json();
      else if(typeof response?.json === "function") details = await response.json();
    } catch(_error){}
    const code = clean(details?.code || details?.error).toLocaleUpperCase();
    const message = clean(`${details?.message || ""} ${error?.message || ""}`).toLocaleLowerCase();
    const key = status === 401 || code === "INVALID_CREDENTIALS"
      ? "citationLookupSessionExpired"
      : code.includes("DAILY_RATE_LIMIT")
        ? "citationLookupDailyLimited"
        : status === 429 || code.includes("RATE_LIMIT")
        ? "citationLookupRateLimited"
        : code.includes("TIMEOUT") || message.includes("citation_lookup_timeout") || message.includes("timed out")
          ? "citationLookupTimedOut"
        : code.includes("SEARCH_NOT_CONFIGURED")
          ? "citationSearchUnavailable"
          : [413, 415, 422].includes(status) || code.includes("UNSUPPORTED") || code.includes("TOO_LARGE")
            ? "citationLookupUnsupported"
            : status === 404 || message.includes("not found") || message.includes("failed to send")
              ? "citationLookupUnavailable"
              : "citationLookupFailed";
    return {status, code, message, key};
  }

  async function lookupErrorKey(error){
    return (await lookupErrorDetails(error)).key;
  }

  async function invokeCitationFunction(client, body, controller, timeoutMs){
    let timeoutId;
    try {
      const timeout = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          controller.abort();
          reject(new Error("citation_lookup_timeout"));
        }, Math.max(1, timeoutMs));
      });
      return await Promise.race([
        client.functions.invoke("fetch-citation-metadata", {body, signal:controller.signal}),
        timeout
      ]);
    } finally { clearTimeout(timeoutId); }
  }

  function acceptSearchResponse(data){
    const rawResults = Array.isArray(data?.results) ? data.results : [];
    const results = rawResults.map(normalizeSearchResult).filter(Boolean).slice(0, 10);
    state.searchResults = results;
    state.searchProvider = clean(data?.searchProvider);
    renderSearchResults({focus:results.length > 0});
    if(!results.length){
      setLookupStatus(tr("citationSearchNoResults"), "warning");
      return false;
    }
    const exactOnly = data?.exactMatchOnly === true || (results.length === 1 && results[0].exactMatch);
    setLookupStatus(tr(exactOnly ? "citationSearchExactOnly" : "citationSearchReview"), "success");
    return true;
  }

  async function lookupWebsiteMetadata(){
    if(state.lookupBusy) return;
    const input = searchInputInfo(byId("citationAutomaticUrl")?.value);
    if(!input.query){ setLookupStatus(tr("citationLookupRequired"), "error"); return; }
    if(!input.valid){ setLookupStatus(tr("citationLookupInvalid"), "error"); return; }
    const client = typeof authClient !== "undefined" ? authClient : null;
    const user = typeof currentUser !== "undefined" ? currentUser : null;
    if(!client || !user){ setLookupStatus(tr("citationLookupSignIn"), "error"); return; }

    state.lookupAbortController?.abort();
    const controller = new AbortController();
    state.lookupAbortController = controller;
    const request = ++state.lookupRequest;
    const deadline = Date.now() + 18000;
    state.searchQuery = input.query;
    state.searchProvider = "";
    state.searchResults = [];
    renderSearchResults();
    byId("citationAutomaticUrl").value = input.url || input.query;
    setLookupBusy(true, "search");
    setLookupStatus(tr("citationFindingSource"), "loading");
    try {
      let {data, error} = await invokeCitationFunction(client, {
        action:"search",
        query:input.query,
        language:language()
      }, controller, deadline - Date.now());
      if(request !== state.lookupRequest) return;

      // An older deployed function will not understand search requests yet.
      // Keep exact-URL search useful while the new function is being deployed.
      if(error && input.url && !controller.signal.aborted && Date.now() < deadline){
        const fallback = await invokeCitationFunction(client, {url:input.url}, controller, deadline - Date.now());
        if(request !== state.lookupRequest) return;
        if(!fallback.error && fallback.data){
          const exact = normalizeSearchResult({...fallback.data, url:input.url, exactMatch:true}, 0);
          data = exact ? {results:[exact], searchProvider:"exact-url"} : null;
          error = null;
        } else error = fallback.error || error;
      }
      if(error){
        clearSearchResults();
        setLookupStatus(tr(await lookupErrorKey(error)), "error");
        return;
      }
      const stillActive = document.querySelector('input[name="citationSource"]:checked')?.value === "website"
        && document.querySelector('input[name="citationEntryMode"]:checked')?.value !== "manual"
        && !byId("hubAcademicToolsView")?.hidden;
      if(!stillActive) return;
      if(!data || typeof data !== "object"){
        clearSearchResults();
        setLookupStatus(tr("citationLookupFailed"), "error");
        return;
      }
      acceptSearchResponse(data);
    } catch(_error){
      if(request === state.lookupRequest){
        clearSearchResults();
        setLookupStatus(tr("citationLookupFailed"), "error");
      }
    } finally {
      if(request === state.lookupRequest){
        state.lookupAbortController = null;
        setLookupBusy(false);
      }
    }
  }

  async function selectSearchResult(index){
    if(state.lookupBusy) return;
    const candidate = state.searchResults[index];
    if(!candidate) return;
    if(websiteDraftHasContent() && !window.confirm(tr("citationLookupReplaceConfirm"))) return;
    const client = typeof authClient !== "undefined" ? authClient : null;
    const user = typeof currentUser !== "undefined" ? currentUser : null;
    if(!client || !user){ setLookupStatus(tr("citationLookupSignIn"), "error"); return; }

    state.lookupAbortController?.abort();
    const controller = new AbortController();
    state.lookupAbortController = controller;
    const request = ++state.lookupRequest;
    setLookupBusy(true, "select");
    setLookupStatus(tr("citationSelectingSource"), "loading");
    try {
      const {data, error} = await invokeCitationFunction(client, {url:candidate.url}, controller, 16000);
      if(request !== state.lookupRequest) return;
      if(error){
        setLookupStatus(tr(await lookupErrorKey(error)), "error");
        return;
      }
      const metadataUrl = normalizedWebsiteUrl(data?.canonicalUrl || data?.finalUrl || data?.sourceUrl);
      if(!data || typeof data !== "object" || !clean(data.title) || !metadataUrl){
        setLookupStatus(tr("citationLookupFailed"), "error");
        return;
      }
      clearSearchResults();
      applyWebsiteMetadata(data);
    } catch(error){
      if(request === state.lookupRequest){
        setLookupStatus(tr(await lookupErrorKey(error)), "error");
      }
    } finally {
      if(request === state.lookupRequest){
        state.lookupAbortController = null;
        setLookupBusy(false);
      }
    }
  }

  function editCurrentReference(){
    const reference = byId("citationOutput");
    if(!reference) return;
    const style = selectedStyle();
    const record = recordFromForm();
    if(!owns(state.overrideBaseFingerprints, style)) state.overrideBaseFingerprints[style] = sourceFingerprint(record);
    const rawReference = String(reference.innerText || "");
    const exceededLimit = rawReference.length > MAX_REFERENCE_LENGTH;
    const override = cleanReference(rawReference);
    if(exceededLimit || (!override && reference.childNodes.length)){
      reference.replaceChildren();
      if(override) reference.append(document.createTextNode(override));
      if(exceededLimit){
        reference.focus();
        const selection = window.getSelection?.();
        const range = document.createRange?.();
        if(selection && range){
          range.selectNodeContents(reference);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
    state.draftOverrides[style] = override;
    const validation = validateRecord(record);
    const generated = record.title && !validation.errors.length ? formatRecord(record, style, 1) : null;
    state.preview = {record, style, generated, plain:override, html:referenceTextHtml(override), inline:generated?.inline || "", custom:true};
    reference.className = `citation-render citation-editable-reference is-edited${override ? "" : " is-placeholder"}`;
    updateReferenceEditUi(true);
    byId("copyCitation").disabled = !override;
    byId("addCitation").disabled = !override || !record.title || validation.errors.length > 0;
    if(exceededLimit) setStatus(tr("citationReferenceLimit"), "error", true);
    else setStatus(tr(validation.errors[0] || "citationEditedStatus"), validation.errors.length ? "error" : "edited", false);
  }

  function restoreGeneratedReference(){
    const style = selectedStyle();
    delete state.draftOverrides[style];
    delete state.overrideBaseFingerprints[style];
    renderPreview({announce:true});
    if(state.preview) setStatus(tr("citationRestored"), "success", true);
    byId("citationOutput")?.focus();
  }

  function pastePlainReference(event){
    const text = cleanReference(event.clipboardData?.getData("text/plain"));
    if(!text) return;
    event.preventDefault();
    const selection = window.getSelection?.();
    if(!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    byId("citationOutput")?.dispatchEvent(new Event("input", {bubbles:true}));
  }

  function resetFormState(){
    cancelLookup({clearResults:true});
    state.draftOverrides = Object.create(null);
    state.overrideBaseFingerprints = Object.create(null);
    setLookupBusy(false);
    byId("citationForm")?.reset();
    if(byId("citationAccessDate")) byId("citationAccessDate").value = localDateValue();
    syncSourceFields({render:false});
    syncStyle({render:false});
    setPreviewPlaceholder();
    setLookupStatus("");
    setStatus("");
  }

  function clearForm(){
    resetFormState();
    byId("citationTitle")?.focus();
  }

  function loadCitationExample(exampleName){
    const example = CITATION_EXAMPLES[exampleName];
    if(!example) return;
    resetFormState();
    const styleControl = document.querySelector('input[name="citationStyle"][value="apa"]');
    const sourceControl = document.querySelector(`input[name="citationSource"][value="${example.source}"]`);
    if(styleControl) styleControl.checked = true;
    if(sourceControl) sourceControl.checked = true;
    if(example.source === "website"){
      const manualControl = document.querySelector('input[name="citationEntryMode"][value="manual"]');
      if(manualControl) manualControl.checked = true;
    }
    syncSourceFields({render:false});
    syncStyle({render:false});
    Object.entries(example.fields).forEach(([id, value]) => {
      const control = byId(id);
      if(control) control.value = value;
    });
    if(example.source === "website"){
      if(byId("citationAutomaticUrl")) byId("citationAutomaticUrl").value = example.fields.citationLocator || "";
      if(byId("citationAccessDate")) byId("citationAccessDate").value = localDateValue();
    }
    renderPreview({announce:true});
    setStatus(tr("citationExampleLoaded"), "success", true);
    const preview = byId("citationPreview");
    preview?.scrollIntoView({
      behavior:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
      block:"center"
    });
    preview?.focus({preventScroll:true});
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
    const heading = byId("citationLibraryTitle");
    if(heading){ heading.tabIndex = -1; heading.focus(); }
    setStatus(tr("bibliographyCleared"), "success", true);
  }

  function refreshLanguage(){
    document.querySelectorAll("[data-academic-i18n]").forEach(element => { element.textContent = tr(element.dataset.academicI18n); });
    document.querySelectorAll("[data-academic-i18n-placeholder]").forEach(element => {
      const value = tr(element.dataset.academicI18nPlaceholder);
      if(element.hasAttribute("contenteditable")){
        element.dataset.placeholder = value;
        element.setAttribute("aria-placeholder", value);
      }
      else element.placeholder = value;
    });
    document.querySelectorAll("[data-academic-i18n-aria-label]").forEach(element => { element.setAttribute("aria-label", tr(element.dataset.academicI18nAriaLabel)); });
    document.querySelectorAll("[data-academic-i18n-alt]").forEach(element => { element.setAttribute("alt", tr(element.dataset.academicI18nAlt)); });
    setLookupBusy(state.lookupBusy, state.lookupMode);
    renderSearchResults();
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

  function deactivate(){
    cancelLookup({clearResults:true});
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
    byId("citationForm").addEventListener("submit", event => {
      event.preventDefault();
    });
    byId("citationAutomaticUrl")?.addEventListener("keydown", event => {
      if(event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      void lookupWebsiteMetadata();
    });
    byId("citationForm").addEventListener("input", event => {
      if(event.target.id === "citationAutomaticUrl"){
        if(state.lookupBusy) cancelLookup({clearStatus:true, clearResults:true});
        else {
          if(state.searchResults.length) clearSearchResults();
          setLookupStatus("");
        }
      } else schedulePreview();
    });
    byId("citationForm").addEventListener("change", event => {
      if(event.target.name === "citationSource") syncSourceFields();
      else if(event.target.name === "citationStyle") syncStyle();
      else if(event.target.name === "citationEntryMode") syncEntryMode();
      else schedulePreview();
    });
    byId("clearCitation")?.addEventListener("click", clearForm);
    byId("citationLookupWebsite")?.addEventListener("click", () => void lookupWebsiteMetadata());
    byId("citationSearchResultsList")?.addEventListener("click", event => {
      const button = event.target.closest?.("[data-citation-result-index]");
      if(!button) return;
      const index = Number(button.dataset.citationResultIndex);
      if(Number.isInteger(index)) void selectSearchResult(index);
    });
    document.querySelector(".citation-example-actions")?.addEventListener("click", event => {
      const button = event.target.closest?.("[data-citation-example]");
      if(button) loadCitationExample(button.dataset.citationExample);
    });
    byId("citationOutput")?.addEventListener("input", editCurrentReference);
    byId("citationOutput")?.addEventListener("paste", pastePlainReference);
    byId("restoreCitation")?.addEventListener("click", restoreGeneratedReference);
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
    deactivate,
    reset,
    refreshLanguage,
    __test:Object.freeze({formatRecord, effectiveFormat, parseAuthors, normalizeDoi, normalizedWebsiteUrl, searchInputInfo, normalizeSearchResult, validateRecord, fingerprint, sourceFingerprint})
  });

  bind();
})();
