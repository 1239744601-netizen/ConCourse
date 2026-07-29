"use strict";

(() => {
  const hubState = {
    sessionUserId: null,
    generation: 0,
    conversationRequest: 0,
    conversationListRequest: 0,
    feedRequest: 0,
    profileRequest: 0,
    profilePreviewRequest: 0,
    socialConnectionRequest: 0,
    activeView: "community",
    membership: null,
    membershipError: "",
    profile: null,
    profileUserId: null,
    profileLoading: false,
    profileHydrated: false,
    profileDirty: false,
    profilePreview: null,
    profilePreviewReturnFocus: null,
    socialConnectionUserId: null,
    socialIdentities: new Map(),
    socialConnectionLoading: false,
    socialConnectionProvider: null,
    socialReturnHandled: false,
    socialStatus: null,
    actionResolver: null,
    actionReturnFocus: null,
    actionHasInput: false,
    actionInputRequired: false,
    actionRequiredMessage: "",
    actionBackgroundModals: [],
    profilePreviewBackgroundModals: [],
    insightRows: [],
    insightDimensions: [],
    insightsLoaded: false,
    insightDemoMode: "",
    communitySeedState: new Map(),
    communityFeedError: "",
    postCommentPages: new Map(),
    feed: [],
    conversations: [],
    messageDemoMode: false,
    messageDemoDismissed: false,
    messageDemoMessages: [],
    activeConversationId: null,
    activeConversationUserId: null,
    activeConversationName: "",
    activeConversationUsername: "",
    activeConversationContext: "",
    activeConversationCanSend: false,
    messages: [],
    messageHasMore: false,
    messageNextCursor: null,
    messageLoadingOlder: false,
    messageRealtimeChannel: null,
    messageRealtimeActive: false,
    messageRefreshTimer: 0,
    usernameSearchRequest: 0,
    usernameSearchTimer: 0,
    usernameSearchLoading: false,
    usernameSuggestions: [],
    usernameSuggestionIndex: -1,
    messageAvailabilityUpdating: false,
    sendingMessage: false,
    messagePoll: null,
    accountDeletionRequest: null,
    accountDeletionLoading: false,
    schoolVerificationRequest: null,
    schoolVerificationLoading: false,
    schoolVerificationFiles: [],
    schoolVerificationFilePreparing: false,
    schoolVerificationEnhanced: false,
    academicEmailVerificationState: null,
    academicEmailVerificationLoading: false,
    academicEmailVerificationSending: false,
    academicEmailVerificationConfirming: false,
    academicEmailCooldownTimer: 0,
    verificationEvidenceByCase: new Map(),
    verificationEvidenceLoading: new Set(),
    supportRequests: [],
    supportRequestsLoading: false,
    supportRequestSubmitting: false,
    adminContextUserId: null,
    adminRole: "",
    adminCapabilities: new Set(),
    adminContextLoading: false,
    adminQueue: [],
    adminQueueStatus: "submitted",
    adminQueueLoading: false,
    adminQueueError: "",
    adminQueueNotice: "",
    adminQueueNoticeKind: "",
    adminReviewBusy: new Set(),
    ownerSummary: null,
    ownerSummaryLoading: false,
    ownerSummaryError: "",
    verificationWorkflow: "school_verification",
    verificationCounts: {},
    verificationCountsLoading: false,
    verificationCountsError: "",
    verificationCases: [],
    verificationCaseOffset: 0,
    verificationCaseHasMore: false,
    verificationTeam: [],
    verificationTeamLoading: false,
    verificationTeamError: "",
    verificationTeamBusy: new Set(),
    loadingFeed: false,
    loadingConversations: false,
    feedScope: "school",
    feedTopic: "all",
    feedQuery: "",
    feedMode: "all",
    feedOffset: 0,
    feedHasMore: false,
    avatarPendingBlob: null,
    avatarPendingUrl: "",
    avatarPendingMimeType: "",
    avatarPendingExtension: "",
    avatarDeleteRequested: false,
    avatarBusy: false,
    avatarOperation: 0,
    avatarUrlCache: new Map(),
    avatarLoadCache: new Map(),
    composerMedia: [],
    composerMediaBusy: false,
    mediaPrepareOperation: 0,
    publishOperation: 0,
    communityMediaUrlCache: new Map(),
    communityMediaLoadCache: new Map(),
    communityVideoUrlCache: new Map(),
    highlightedPostId: "",
    openCommentPostIds: new Set(),
    likeBusy: new Set(),
    bookmarkBusy: new Set(),
    pollBusy: new Set()
  };

  const communityMediaObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const action = entry.isIntersecting
            ? entry.target._loadCommunityMedia
            : entry.target._unloadCommunityMedia;
          if(typeof action === "function") action();
        });
      }, {rootMargin:"1200px 0px"})
    : null;
  let heicDecoderPromise = null;

  const SOCIAL_PROVIDERS = Object.freeze({
    google: Object.freeze({provider:"google", label:"Google", mark:"G"}),
    github: Object.freeze({provider:"github", label:"GitHub", mark:"GH"})
  });
  const SOCIAL_RETURN_KEY = "concourse_social_connection_return";
  const SOCIAL_OAUTH_RETURN_URL = "https://concoursehk.pages.dev/";
  const AVATAR_URL_CACHE_LIMIT = 48;
  const COMMUNITY_FEED_PAGE_SIZE = 30;
  const COMMUNITY_FEED_WINDOW = 90;
  const COMMUNITY_COMMENT_PAGE_SIZE = 30;
  const MESSAGE_PAGE_SIZE = 50;
  const HUB_RPC_TIMEOUT_MS = 15000;
  const VERIFICATION_PAGE_SIZE = 40;
  const SCHOOL_VERIFICATION_EVIDENCE_BUCKET = "school-verification-evidence";
  const SCHOOL_VERIFICATION_MAX_FILES = 3;
  const SCHOOL_VERIFICATION_MAX_FILE_BYTES = 8 * 1024 * 1024;
  const SCHOOL_VERIFICATION_EVIDENCE_TTL_SECONDS = 60;
  const SCHOOL_VERIFICATION_DOCUMENT_TYPES = Object.freeze([
    Object.freeze({id:"student_id", labelKey:"documentStudentId"}),
    Object.freeze({id:"enrollment_letter", labelKey:"documentEnrollmentLetter"}),
    Object.freeze({id:"class_schedule", labelKey:"documentClassSchedule"}),
    Object.freeze({id:"portal_screenshot", labelKey:"documentPortalScreenshot"}),
    Object.freeze({id:"other", labelKey:"documentOther"})
  ]);
  const VERIFICATION_WORKFLOWS = Object.freeze([
    Object.freeze({id:"school_verification", scope:"school_verification.review", tabId:"verificationTabSchool", countId:"verificationTabSchoolCount", labelKey:"workflowSchool"}),
    Object.freeze({id:"payment_evidence", scope:"payment_evidence.review", tabId:"verificationTabPayments", countId:"verificationTabPaymentsCount", labelKey:"workflowPayments"}),
    Object.freeze({id:"marketplace_dispute", scope:"marketplace_disputes.review", tabId:"verificationTabDisputes", countId:"verificationTabDisputesCount", labelKey:"workflowDisputes"}),
    Object.freeze({id:"marketplace_report", scope:"marketplace_reports.review", tabId:"verificationTabMarketReports", countId:"verificationTabMarketReportsCount", labelKey:"workflowMarketReports"}),
    Object.freeze({id:"content_report", scope:"content_reports.review", tabId:"verificationTabContentReports", countId:"verificationTabContentReportsCount", labelKey:"workflowContentReports"}),
    Object.freeze({id:"account_deletion", scope:"account_deletion.review", tabId:"verificationTabDeletion", countId:"verificationTabDeletionCount", labelKey:"workflowDeletion"}),
    Object.freeze({id:"support_request", scope:"support_requests.review", tabId:"verificationTabSupport", countId:"verificationTabSupportCount", labelKey:"workflowSupport"})
  ]);
  const VERIFICATION_STATUS_KEYS = Object.freeze({
    school_verification:["submitted","under_review","approved","rejected","withdrawn"],
    payment_evidence:["submitted","under_review","evidence_accepted","rejected","withdrawn"],
    marketplace_dispute:["open","under_review","resolved_buyer","resolved_seller","closed"],
    marketplace_report:["open","reviewing","resolved","dismissed"],
    content_report:["open","reviewing","resolved","dismissed"],
    account_deletion:["submitted","processing","completed","cancelled"],
    support_request:["submitted","under_review","resolved","rejected","withdrawn"]
  });
  const VERIFICATION_ACTIONS = Object.freeze({
    school_verification:["start_review","approve","reject"],
    payment_evidence:["start_review","accept_evidence","reject"],
    marketplace_dispute:["start_review","recommend_refund","recommend_release","close"],
    marketplace_report:["start_review","resolve","dismiss"],
    content_report:["start_review","resolve","dismiss"],
    account_deletion:["start_review","return_to_queue"],
    support_request:["start_review","resolve","reject"]
  });
  let hubStickyGeometryFrame = 0;
  let hubStickyGeometryObserver = null;

  function syncHubStickyGeometry(){
    const hub = document.getElementById("memberHub");
    const destinationRail = hub?.querySelector(".hub-sidebar");
    if(!hub || !destinationRail) return;
    const railIsSticky = getComputedStyle(destinationRail).position === "sticky";
    const railHeight = !hub.hidden && railIsSticky
      ? Math.ceil(destinationRail.getBoundingClientRect().height * 100) / 100
      : 0;
    hub.style.setProperty("--hub-destination-rail-height", `${railHeight}px`);
  }

  function scheduleHubStickyGeometry(){
    if(hubStickyGeometryFrame) cancelAnimationFrame(hubStickyGeometryFrame);
    hubStickyGeometryFrame = requestAnimationFrame(() => {
      hubStickyGeometryFrame = 0;
      syncHubStickyGeometry();
    });
  }

  function observeHubStickyGeometry(){
    const destinationRail = document.querySelector("#memberHub .hub-sidebar");
    if(!destinationRail) return;
    if(typeof ResizeObserver === "function"){
      hubStickyGeometryObserver = new ResizeObserver(scheduleHubStickyGeometry);
      hubStickyGeometryObserver.observe(destinationRail);
    }
    window.addEventListener("resize", scheduleHubStickyGeometry, {passive:true});
    document.fonts?.ready?.then(scheduleHubStickyGeometry);
    scheduleHubStickyGeometry();
  }

  const COMMUNITY_SEED_POSTS = Object.freeze([
    Object.freeze({
      key:"finance-revision",
      initials:"MC",
      author:"Maya Chen",
      avatar:Object.freeze({src:"concourse-community-library.jpg", position:"53% 30%"}),
      meta:Object.freeze({
        en:"University student · Finance · 24 min",
        "zh-CN":"大学生 · 金融学 · 24 分钟前",
        "zh-HK":"大學生 · 金融 · 24 分鐘前"
      }),
      body:Object.freeze({
        en:"Our FIN 3010 revision group mapped the toughest valuation topics today. We are opening the next session to anyone who wants to compare approaches before the midterm.",
        "zh-CN":"今天的 FIN 3010 复习小组整理了最难的估值主题。下次活动欢迎同学加入，一起在期中考试前交流解题思路。",
        "zh-HK":"今日嘅 FIN 3010 溫習小組整理咗最難嘅估值主題。下次活動歡迎同學加入，一齊喺期中試前交流解題思路。"
      }),
      image:"concourse-community-library.jpg",
      imageAlt:Object.freeze({
        en:"Three students comparing revision notes around a laptop in a university library.",
        "zh-CN":"三名学生在大学图书馆围着笔记本电脑交流复习笔记。",
        "zh-HK":"三位學生喺大學圖書館圍住手提電腦交流溫習筆記。"
      }),
      tags:Object.freeze(["FIN3010", "revision"]),
      likeCount:46,
      commentCount:8,
      comments:Object.freeze([
        Object.freeze({
          author:"Jason Ho",
          body:Object.freeze({
            en:"I can bring last week's practice set. Should we start with the DCF questions?",
            "zh-CN":"我可以带上周的练习题。我们要不要先从 DCF 题目开始？",
            "zh-HK":"我可以帶上星期嘅練習題。我哋不如先由 DCF 題目開始？"
          }),
          time:Object.freeze({en:"12 min", "zh-CN":"12 分钟前", "zh-HK":"12 分鐘前"})
        }),
        Object.freeze({
          author:"Chloe Lam",
          body:Object.freeze({
            en:"Wednesday at 16:00 works for me. I have reserved a discussion room on level 4.",
            "zh-CN":"周三 16:00 我可以。我已经预订了四楼的讨论室。",
            "zh-HK":"星期三 16:00 我可以。我已經預訂咗四樓嘅討論室。"
          }),
          time:Object.freeze({en:"8 min", "zh-CN":"8 分钟前", "zh-HK":"8 分鐘前"})
        }),
        Object.freeze({
          author:"Ethan Wong",
          body:Object.freeze({
            en:"Could someone share the WACC checklist after the session? It would help me review.",
            "zh-CN":"活动结束后可以分享 WACC 检查清单吗？这对我复习很有帮助。",
            "zh-HK":"活動完咗之後可唔可以分享 WACC 檢查清單？會幫到我溫習。"
          }),
          time:Object.freeze({en:"3 min", "zh-CN":"3 分钟前", "zh-HK":"3 分鐘前"})
        }),
        Object.freeze({
          author:"Natalie Fong",
          body:Object.freeze({
            en:"Could we add a short multiples comparison after DCF? I still mix up EV/EBITDA and P/E.",
            "zh-CN":"讲完 DCF 后可以加一个估值倍数比较吗？我还是容易混淆 EV/EBITDA 和 P/E。",
            "zh-HK":"講完 DCF 之後可唔可以加一個估值倍數比較？我仲係好易混淆 EV/EBITDA 同 P/E。"
          }),
          time:Object.freeze({en:"7 min", "zh-CN":"7 分钟前", "zh-HK":"7 分鐘前"})
        }),
        Object.freeze({
          author:"Ryan Chan",
          body:Object.freeze({
            en:"I made a one-page formula sheet and will upload it before Wednesday.",
            "zh-CN":"我整理了一页公式表，会在周三前上传。",
            "zh-HK":"我整理咗一頁公式表，會喺星期三之前上載。"
          }),
          time:Object.freeze({en:"6 min", "zh-CN":"6 分钟前", "zh-HK":"6 分鐘前"})
        }),
        Object.freeze({
          author:"Zoe Li",
          body:Object.freeze({
            en:"Is the session open to second-year students? We start valuation next week.",
            "zh-CN":"大二学生也可以参加吗？我们下周刚开始学习估值。",
            "zh-HK":"二年級學生都可以參加嗎？我哋下星期啱啱開始學估值。"
          }),
          time:Object.freeze({en:"5 min", "zh-CN":"5 分钟前", "zh-HK":"5 分鐘前"})
        }),
        Object.freeze({
          author:"Daniel Wu",
          body:Object.freeze({
            en:"I can walk through terminal-value sensitivity if anyone wants another example.",
            "zh-CN":"如果大家需要，我可以再讲一个终值敏感性分析的例子。",
            "zh-HK":"如果大家需要，我可以再講一個終值敏感度分析嘅例子。"
          }),
          time:Object.freeze({en:"2 min", "zh-CN":"2 分钟前", "zh-HK":"2 分鐘前"})
        }),
        Object.freeze({
          author:"Grace Leung",
          body:Object.freeze({
            en:"Please save one seat for me. I will bring the case-study marking guide.",
            "zh-CN":"请帮我留一个座位，我会带上案例分析的评分指引。",
            "zh-HK":"麻煩幫我留一個位，我會帶埋案例分析嘅評分指引。"
          }),
          time:Object.freeze({en:"just now", "zh-CN":"刚刚", "zh-HK":"啱啱"})
        })
      ]),
      poll:Object.freeze({
        question:Object.freeze({
          en:"When should the next session run?",
          "zh-CN":"下次复习安排在什么时候？",
          "zh-HK":"下次溫習安排喺幾時？"
        }),
        options:Object.freeze([
          Object.freeze({label:Object.freeze({en:"Tuesday · 17:30", "zh-CN":"周二 · 17:30", "zh-HK":"星期二 · 17:30"}), votes:22}),
          Object.freeze({label:Object.freeze({en:"Wednesday · 16:00", "zh-CN":"周三 · 16:00", "zh-HK":"星期三 · 16:00"}), votes:17}),
          Object.freeze({label:Object.freeze({en:"Friday · online", "zh-CN":"周五 · 线上", "zh-HK":"星期五 · 網上"}), votes:11})
        ])
      })
    }),
    Object.freeze({
      key:"campus-plant-swap",
      initials:"AR",
      author:"Aisha Rahman",
      avatar:Object.freeze({src:"concourse-community-club.jpg", position:"35% 28%"}),
      meta:Object.freeze({
        en:"Campus Sustainability Society · 42 min",
        "zh-CN":"校园可持续发展学会 · 42 分钟前",
        "zh-HK":"校園可持續發展學會 · 42 分鐘前"
      }),
      body:Object.freeze({
        en:"Plant swap this Thursday beside the central lawn. Bring one cutting, seedling, or clean reusable item; first-time growers are absolutely welcome.",
        "zh-CN":"本周四在中央草坪旁举行植物交换活动。带上一株扦插苗、幼苗或干净的可重复使用物品即可，新手也非常欢迎。",
        "zh-HK":"今個星期四喺中央草地旁邊舉行植物交換活動。帶一株插枝、幼苗或者乾淨嘅可重用物品就可以，新手都非常歡迎。"
      }),
      image:"concourse-community-club.jpg",
      imageAlt:Object.freeze({
        en:"Students arranging herb seedlings and reusable items on a campus lawn.",
        "zh-CN":"学生们在校园草坪上整理香草幼苗和可重复使用物品。",
        "zh-HK":"學生喺校園草地上整理香草幼苗同可重用物品。"
      }),
      tags:Object.freeze(["campuslife", "sustainability"]),
      likeCount:83,
      commentCount:14,
      comments:Object.freeze([
        Object.freeze({
          author:"Priya Shah",
          body:Object.freeze({
            en:"I have two mint cuttings and three small pots to share.",
            "zh-CN":"我有两株薄荷扦插苗和三个小花盆可以交换。",
            "zh-HK":"我有兩株薄荷插枝同三個小花盆可以交換。"
          }),
          time:Object.freeze({en:"21 min", "zh-CN":"21 分钟前", "zh-HK":"21 分鐘前"})
        }),
        Object.freeze({
          author:"Toby Lee",
          body:Object.freeze({
            en:"Can I join if I do not have a plant yet? I can bring clean reusable jars.",
            "zh-CN":"我还没有植物也可以参加吗？我可以带干净的可重复使用玻璃罐。",
            "zh-HK":"我仲未有植物都可以參加嗎？我可以帶乾淨嘅可重用玻璃樽。"
          }),
          time:Object.freeze({en:"16 min", "zh-CN":"16 分钟前", "zh-HK":"16 分鐘前"})
        }),
        Object.freeze({
          author:"Hana Kim",
          body:Object.freeze({
            en:"I will label the herbs so first-time growers know the light and watering routine.",
            "zh-CN":"我会给香草加上标签，方便新手了解光照和浇水方式。",
            "zh-HK":"我會幫香草加標籤，等新手知道光照同淋水方法。"
          }),
          time:Object.freeze({en:"9 min", "zh-CN":"9 分钟前", "zh-HK":"9 分鐘前"})
        }),
        Object.freeze({
          author:"Noah Cheng",
          body:Object.freeze({
            en:"Which side of the central lawn will the tables be on?",
            "zh-CN":"摊位会设在中央草坪的哪一边？",
            "zh-HK":"攤位會設喺中央草地邊一面？"
          }),
          time:Object.freeze({en:"8 min", "zh-CN":"8 分钟前", "zh-HK":"8 分鐘前"})
        }),
        Object.freeze({
          author:"Olivia Wong",
          body:Object.freeze({
            en:"I have several spider-plant babies that are ready for new homes.",
            "zh-CN":"我有几株吊兰幼苗，已经可以带去新家了。",
            "zh-HK":"我有幾株吊蘭幼苗，已經可以帶去新屋企喇。"
          }),
          time:Object.freeze({en:"7 min", "zh-CN":"7 分钟前", "zh-HK":"7 分鐘前"})
        }),
        Object.freeze({
          author:"Kelvin Tang",
          body:Object.freeze({
            en:"Happy to help at the welcome table and make plant-care labels.",
            "zh-CN":"我可以在接待桌帮忙，也可以制作植物养护标签。",
            "zh-HK":"我可以喺接待枱幫手，亦可以整植物護理標籤。"
          }),
          time:Object.freeze({en:"6 min", "zh-CN":"6 分钟前", "zh-HK":"6 分鐘前"})
        }),
        Object.freeze({
          author:"Amira Yusuf",
          body:Object.freeze({
            en:"Would packets of basil and coriander seeds be useful too?",
            "zh-CN":"罗勒和香菜种子包也适合带来交换吗？",
            "zh-HK":"羅勒同芫荽種子包都適合帶嚟交換嗎？"
          }),
          time:Object.freeze({en:"5 min", "zh-CN":"5 分钟前", "zh-HK":"5 分鐘前"})
        }),
        Object.freeze({
          author:"Jacky Ma",
          body:Object.freeze({
            en:"I cleaned six glass jars this morning and can drop them off early.",
            "zh-CN":"我今早清洗了六个玻璃罐，可以提前送过去。",
            "zh-HK":"我今朝洗乾淨咗六個玻璃樽，可以早啲拎過去。"
          }),
          time:Object.freeze({en:"4 min", "zh-CN":"4 分钟前", "zh-HK":"4 分鐘前"})
        }),
        Object.freeze({
          author:"Sarah Lo",
          body:Object.freeze({
            en:"Is there an indoor backup location if it rains on Thursday?",
            "zh-CN":"如果周四下雨，有室内备用场地吗？",
            "zh-HK":"如果星期四落雨，有冇室內後備場地？"
          }),
          time:Object.freeze({en:"4 min", "zh-CN":"4 分钟前", "zh-HK":"4 分鐘前"})
        }),
        Object.freeze({
          author:"Kenji Sato",
          body:Object.freeze({
            en:"My class ends at 17:30. Will the swap still be running then?",
            "zh-CN":"我的课到 17:30 才结束，那时活动还会继续吗？",
            "zh-HK":"我堂課到 17:30 先完，嗰陣活動仲會唔會繼續？"
          }),
          time:Object.freeze({en:"3 min", "zh-CN":"3 分钟前", "zh-HK":"3 分鐘前"})
        }),
        Object.freeze({
          author:"Michelle Ko",
          body:Object.freeze({
            en:"Please keep a clear route between the tables for wheelchair access.",
            "zh-CN":"请在桌子之间保留通道，方便轮椅通行。",
            "zh-HK":"麻煩喺枱之間留返通道，方便輪椅出入。"
          }),
          time:Object.freeze({en:"2 min", "zh-CN":"2 分钟前", "zh-HK":"2 分鐘前"})
        }),
        Object.freeze({
          author:"Dylan Tse",
          body:Object.freeze({
            en:"I can bring two unopened bags of potting soil for everyone to share.",
            "zh-CN":"我可以带两袋未开封的营养土给大家一起用。",
            "zh-HK":"我可以帶兩包未開封嘅培養土俾大家一齊用。"
          }),
          time:Object.freeze({en:"2 min", "zh-CN":"2 分钟前", "zh-HK":"2 分鐘前"})
        }),
        Object.freeze({
          author:"Iman Ali",
          body:Object.freeze({
            en:"May I take a few photos for the society newsletter if everyone agrees?",
            "zh-CN":"如果大家同意，我可以拍几张照片放在学会通讯里吗？",
            "zh-HK":"如果大家同意，我可唔可以影幾張相放喺學會通訊度？"
          }),
          time:Object.freeze({en:"1 min", "zh-CN":"1 分钟前", "zh-HK":"1 分鐘前"})
        }),
        Object.freeze({
          author:"Vivian Cheung",
          body:Object.freeze({
            en:"I can collect any leftover pots for the community garden afterward.",
            "zh-CN":"活动结束后，我可以把剩余花盆带到社区花园。",
            "zh-HK":"活動完咗之後，我可以將剩低嘅花盆帶去社區花園。"
          }),
          time:Object.freeze({en:"just now", "zh-CN":"刚刚", "zh-HK":"啱啱"})
        })
      ])
    }),
    Object.freeze({
      key:"project-courtyard",
      initials:"LK",
      author:"Leo Kwok",
      avatar:Object.freeze({src:"concourse-campus-community.jpg", position:"82% 34%"}),
      meta:Object.freeze({
        en:"University student · Computer Science · 1 h",
        "zh-CN":"大学生 · 计算机科学 · 1 小时前",
        "zh-HK":"大學生 · 電腦科學 · 1 小時前"
      }),
      body:Object.freeze({
        en:"Our project team tested the new courtyard study tables this morning. Strong Wi-Fi, quiet before noon, and enough shade for a long working session.",
        "zh-CN":"我们的小组今早试用了庭院的新学习桌。无线网络稳定，中午前很安静，遮阴也足够，适合长时间学习。",
        "zh-HK":"我哋小組今朝試用咗庭院嘅新溫習枱。Wi-Fi 穩定，中午前好安靜，亦有足夠遮蔭，適合長時間做嘢。"
      }),
      image:"concourse-campus-community.jpg",
      imageAlt:Object.freeze({
        en:"University students working together with notebooks in an outdoor campus space.",
        "zh-CN":"大学生在校园户外空间一起使用笔记本学习。",
        "zh-HK":"大學生喺校園戶外空間一齊用筆記簿學習。"
      }),
      tags:Object.freeze(["studyspot", "campustips"]),
      likeCount:31,
      commentCount:5,
      comments:Object.freeze([
        Object.freeze({
          author:"Emma Lau",
          body:Object.freeze({
            en:"This is exactly the quiet spot I needed. Are the power sockets working?",
            "zh-CN":"这正是我需要的安静学习地点。那里的电源插座可以用吗？",
            "zh-HK":"呢度正正係我需要嘅安靜溫習位。嗰度啲插座用唔用到？"
          }),
          time:Object.freeze({en:"38 min", "zh-CN":"38 分钟前", "zh-HK":"38 分鐘前"})
        }),
        Object.freeze({
          author:"Marcus Yip",
          body:Object.freeze({
            en:"The sockets beside the long table work. It starts getting busy after 13:00.",
            "zh-CN":"长桌旁边的插座可以用，13:00 后人会开始多起来。",
            "zh-HK":"長枱旁邊啲插座用到，13:00 之後會開始多人。"
          }),
          time:Object.freeze({en:"29 min", "zh-CN":"29 分钟前", "zh-HK":"29 分鐘前"})
        }),
        Object.freeze({
          author:"Sophie Ng",
          body:Object.freeze({
            en:"Adding this to my study-spot list. Thanks for checking the Wi-Fi.",
            "zh-CN":"已加入我的学习地点清单，谢谢你测试无线网络。",
            "zh-HK":"已經加咗落我嘅溫習地點清單，多謝你測試 Wi-Fi。"
          }),
          time:Object.freeze({en:"17 min", "zh-CN":"17 分钟前", "zh-HK":"17 分鐘前"})
        }),
        Object.freeze({
          author:"Nathan Chiu",
          body:Object.freeze({
            en:"The shade is best between 10:00 and noon. After that, the west table gets warm.",
            "zh-CN":"10:00 到中午的遮阴最好，之后西侧的桌子会比较热。",
            "zh-HK":"10:00 到中午嘅遮蔭最好，之後西邊張枱會比較熱。"
          }),
          time:Object.freeze({en:"11 min", "zh-CN":"11 分钟前", "zh-HK":"11 分鐘前"})
        }),
        Object.freeze({
          author:"Isabella Tam",
          body:Object.freeze({
            en:"The step-free route from the library lift takes about three minutes.",
            "zh-CN":"从图书馆电梯走无障碍路线过去大约需要三分钟。",
            "zh-HK":"由圖書館升降機行無障礙路線過去大約要三分鐘。"
          }),
          time:Object.freeze({en:"5 min", "zh-CN":"5 分钟前", "zh-HK":"5 分鐘前"})
        })
      ])
    })
  ]);
  const INSIGHT_DEMO = Object.freeze({
    major:Object.freeze({
      summary:Object.freeze({cohortSize:40, medianCredits:18, sectionCount:11, professorCount:8}),
      courses:Object.freeze([
        Object.freeze({course_key:"FIN-310", course_code:"FIN 310", course_name:"Corporate Finance", selection_count:31, share_percent:78}),
        Object.freeze({course_key:"BUS-320", course_code:"BUS 320", course_name:"Business Analytics", selection_count:27, share_percent:68}),
        Object.freeze({course_key:"MGT-305", course_code:"MGT 305", course_name:"Strategic Management", selection_count:22, share_percent:55}),
        Object.freeze({course_key:"ACC-302", course_code:"ACC 302", course_name:"Financial Reporting", selection_count:18, share_percent:45}),
        Object.freeze({course_key:"ECO-318", course_code:"ECO 318", course_name:"International Economics", selection_count:14, share_percent:35})
      ]),
      sections:Object.freeze([
        Object.freeze({section:"FIN 310 · 01", professor:"Dr. Mira Chen", schedule:"T / Th · 10:30", selection_count:29, demand_percent:91}),
        Object.freeze({section:"BUS 320 · 02", professor:"Dr. Theo Lau", schedule:"M / W · 14:30", selection_count:25, demand_percent:83}),
        Object.freeze({section:"MGT 305 · 01", professor:"Dr. Hana Lee", schedule:"W · 09:30", selection_count:21, demand_percent:70}),
        Object.freeze({section:"ACC 302 · 03", professor:"Dr. Noah Wong", schedule:"T / F · 12:30", selection_count:17, demand_percent:57})
      ]),
      professors:Object.freeze([
        Object.freeze({name:"Dr. Mira Chen", course_codes:"FIN 310", section_count:2, selection_count:29, share_percent:73}),
        Object.freeze({name:"Dr. Theo Lau", course_codes:"BUS 320 · DAT 330", section_count:2, selection_count:25, share_percent:63}),
        Object.freeze({name:"Dr. Hana Lee", course_codes:"MGT 305", section_count:1, selection_count:21, share_percent:53}),
        Object.freeze({name:"Dr. Noah Wong", course_codes:"ACC 302", section_count:2, selection_count:17, share_percent:43})
      ]),
      creditDistribution:Object.freeze([
        Object.freeze({label:"12–14", value:10, share_percent:25}),
        Object.freeze({label:"15–17", value:8, share_percent:20}),
        Object.freeze({label:"18–20", value:17, share_percent:43}),
        Object.freeze({label:"21+", value:5, share_percent:12})
      ]),
      timetablePatterns:Object.freeze({
        time:Object.freeze([
          Object.freeze({labelKey:"insightMorning", share_percent:38}),
          Object.freeze({labelKey:"insightAfternoon", share_percent:48}),
          Object.freeze({labelKey:"insightEvening", share_percent:14})
        ]),
        days:Object.freeze([
          Object.freeze({labelKey:"insightThreeCampusDays", share_percent:28}),
          Object.freeze({labelKey:"insightFourCampusDays", share_percent:49}),
          Object.freeze({labelKey:"insightFiveCampusDays", share_percent:23})
        ])
      })
    }),
    university:Object.freeze({
      summary:Object.freeze({cohortSize:260, medianCredits:17, sectionCount:64, professorCount:41}),
      courses:Object.freeze([
        Object.freeze({course_key:"DAT-101", course_code:"DAT 101", course_name:"Data Literacy", selection_count:184, share_percent:71}),
        Object.freeze({course_key:"COM-120", course_code:"COM 120", course_name:"Academic Communication", selection_count:153, share_percent:59}),
        Object.freeze({course_key:"SUS-110", course_code:"SUS 110", course_name:"Sustainability in Practice", selection_count:117, share_percent:45}),
        Object.freeze({course_key:"PSY-101", course_code:"PSY 101", course_name:"Introduction to Psychology", selection_count:96, share_percent:37}),
        Object.freeze({course_key:"ENT-210", course_code:"ENT 210", course_name:"Innovation and Enterprise", selection_count:78, share_percent:30})
      ]),
      sections:Object.freeze([
        Object.freeze({section:"DAT 101 · 04", professor:"Dr. Iris Lam", schedule:"M / Th · 11:30", selection_count:58, demand_percent:94}),
        Object.freeze({section:"COM 120 · 02", professor:"Dr. Elias Ho", schedule:"T / F · 09:30", selection_count:51, demand_percent:85}),
        Object.freeze({section:"SUS 110 · 05", professor:"Dr. Amara Patel", schedule:"W · 13:30", selection_count:44, demand_percent:73}),
        Object.freeze({section:"PSY 101 · 03", professor:"Dr. Leo Ng", schedule:"M / W · 15:30", selection_count:39, demand_percent:65})
      ]),
      professors:Object.freeze([
        Object.freeze({name:"Dr. Iris Lam", course_codes:"DAT 101", section_count:3, selection_count:58, share_percent:22}),
        Object.freeze({name:"Dr. Elias Ho", course_codes:"COM 120 · COM 220", section_count:3, selection_count:51, share_percent:20}),
        Object.freeze({name:"Dr. Amara Patel", course_codes:"SUS 110", section_count:2, selection_count:44, share_percent:17}),
        Object.freeze({name:"Dr. Leo Ng", course_codes:"PSY 101", section_count:2, selection_count:39, share_percent:15})
      ]),
      creditDistribution:Object.freeze([
        Object.freeze({label:"12–14", value:73, share_percent:28}),
        Object.freeze({label:"15–17", value:83, share_percent:32}),
        Object.freeze({label:"18–20", value:78, share_percent:30}),
        Object.freeze({label:"21+", value:26, share_percent:10})
      ]),
      timetablePatterns:Object.freeze({
        time:Object.freeze([
          Object.freeze({labelKey:"insightMorning", share_percent:34}),
          Object.freeze({labelKey:"insightAfternoon", share_percent:52}),
          Object.freeze({labelKey:"insightEvening", share_percent:14})
        ]),
        days:Object.freeze([
          Object.freeze({labelKey:"insightThreeCampusDays", share_percent:21}),
          Object.freeze({labelKey:"insightFourCampusDays", share_percent:46}),
          Object.freeze({labelKey:"insightFiveCampusDays", share_percent:33})
        ])
      })
    })
  });

  const node = (tag, className="", content="") => {
    const element = document.createElement(tag);
    if(className) element.className = className;
    if(content !== "") element.textContent = String(content);
    return element;
  };

  const setStatus = (id, message="", kind="") => {
    const targetId = id === "communityComposerStatus" && hubState.feedScope === "cross"
      ? "communityFeedStatus"
      : id;
    const element = $(targetId);
    if(!element) return;
    element.textContent = message;
    element.className = `hub-inline-status${targetId === "communityFeedStatus" ? " hub-feed-status" : ""}${kind ? ` ${kind}` : ""}`;
  };

  const locale = () => currentLanguage === "zh-CN" ? "zh-CN" : currentLanguage === "zh-HK" ? "zh-HK" : "en-GB";
  const formatDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value || "") : date.toLocaleString(locale(), {dateStyle:"medium", timeStyle:"short"});
  };
  const formatCompactDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(locale(), {month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"});
  };
  const errorText = error => [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(" ");

  const featureError = error => {
    const message = errorText(error);
    if(/verified school membership|membership must be verified|school verification/i.test(message)) return t("schoolVerificationRequired");
    if(/Could not find the function|schema cache|does not exist|relation .* does not exist|PGRST202/i.test(message)) return t("memberSetupRequired");
    if(/already reported/i.test(message)) return t("alreadyReported");
    if(/Please wait/i.test(message)) return t("rateLimited");
    if(/Enable Allow messages/i.test(message)) return t("messageAvailabilityRequired");
    if(/not accepting messages|Messaging is unavailable|blocked the other/i.test(message)) return t("messagingUnavailable");
    if(/No messageable schoolmate/i.test(message)) return t("conversationStartFailed");
    if(/Post is unavailable|Comment is unavailable|Conversation is unavailable|Campus profile is unavailable/i.test(message)) return t("contentUnavailable");
    if(/timed out|timeout|network|failed to fetch|offline|connection/i.test(message)) return t("connectionRetry");
    return t("featureUnavailable");
  };

  const missingRpcError = error => /Could not find the function|function .* does not exist|relation .* does not exist|schema cache|PGRST202|42883|42P01/i.test(errorText(error));

  const conversationStartError = error => {
    const message = errorText(error);
    if(/Enable Allow messages/i.test(message)) return t("messageAvailabilityRequired");
    if(/Multiple usernames differ only by capitalization/i.test(message)) return t("chatUsernameAmbiguous");
    if(/You cannot message yourself|cannot message yourself/i.test(message)) return t("cannotMessageSelf");
    if(/No messageable schoolmate|username.*not found|no account.*username/i.test(message)) return t("conversationStartFailed");
    if(/not accepting messages|Messaging is unavailable|blocked the other/i.test(message)) return t("messagingUnavailable");
    return featureError(error);
  };

  const hubRpc = async (functionName, parameters={}, timeoutMs=HUB_RPC_TIMEOUT_MS) => {
    let timeoutId = 0;
    try {
      return await Promise.race([
        authClient.rpc(functionName, parameters),
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => {
            const error = new Error("Campus service request timed out");
            error.code = "CONCOURSE_RPC_TIMEOUT";
            reject(error);
          }, timeoutMs);
        })
      ]);
    } finally {
      if(timeoutId) window.clearTimeout(timeoutId);
    }
  };

  const wrapMediaUploadError = (error, bucket) => {
    const wrapped = new Error(String(error?.message || "Media upload failed"));
    wrapped.name = "ConCourseMediaUploadError";
    wrapped.mediaUpload = true;
    wrapped.bucket = bucket;
    wrapped.code = error?.code;
    wrapped.status = error?.status || error?.statusCode;
    wrapped.cause = error;
    return wrapped;
  };

  const mediaUploadError = (error, {membershipRequired=false}={}) => {
    const message = String(error?.message || error?.cause?.message || "");
    const status = Number(error?.status || error?.statusCode || error?.cause?.status || error?.cause?.statusCode || 0);
    console.warn("ConCourse media operation failed.", error?.cause || error);
    if(/verified school membership|membership must be verified|school verification/i.test(message)) return t("schoolVerificationRequired");
    if(/payload too large|maximum.*size|file.*size|entity too large/i.test(message) || status === 413) return t("mediaUploadRejected");
    if(error?.mediaUpload && membershipRequired && (status === 401 || status === 403 || /row.level|policy|unauthori[sz]ed|permission/i.test(message))){
      return isAcademicEmailVerifiedStudent() ? t("mediaSetupRequired") : t("schoolVerificationRequired");
    }
    if(/bucket.*not found|not found.*bucket|row.level|policy|permission|mime|content.?type|schema cache|does not exist/i.test(message) || [400, 404, 409].includes(status)) return t("mediaSetupRequired");
    if(/fetch|network|offline|timeout|connection/i.test(message)) return t("mediaUploadNetwork");
    return t("mediaUploadFailed");
  };

  const socialConnectionError = (error, provider) => {
    const message = String(error?.message || "");
    const label = SOCIAL_PROVIDERS[provider]?.label || t("socialAccount");
    if(/manual.*link|identity.*link.*disabled|provider.*(disabled|not enabled)|unsupported provider|provider.*not found/i.test(message)){
      return {key:"providerSetupRequired", variables:{provider:label}};
    }
    return {key:"providerConnectionFailed", variables:{provider:label}};
  };

  const renderSocialConnectionStatus = () => {
    const status = hubState.socialStatus;
    setStatus("socialConnectionStatus", status ? t(status.key, status.variables) : "", status?.kind || "");
  };

  const setSocialConnectionStatus = (key="", variables={}, kind="") => {
    hubState.socialStatus = key ? {key, variables, kind} : null;
    renderSocialConnectionStatus();
  };

  const hubAccessAllowed = () => !!(
    currentUser
    && loadedUserId === currentUser.id
    && finalTimetable?.savedAt
  );
  const requestContext = () => ({generation:hubState.generation, userId:currentUser?.id || null});
  const contextIsCurrent = context => !!(
    context?.userId
    && context.generation === hubState.generation
    && currentUser?.id === context.userId
  );

  function resetSensitiveState(nextUserId){
    revokeAvatarUrls();
    revokeCommunityMediaUrls();
    window.ConCourseMarketplace?.reset(nextUserId);
    window.ConCourseAcademicTools?.reset?.(nextUserId);
    hubState.sessionUserId = nextUserId;
    hubState.generation += 1;
    hubState.conversationRequest += 1;
    hubState.conversationListRequest += 1;
    hubState.feedRequest += 1;
    hubState.profileRequest += 1;
    hubState.profilePreviewRequest += 1;
    hubState.socialConnectionRequest += 1;
    hubState.membership = null;
    hubState.membershipError = "";
    hubState.profile = null;
    hubState.profileUserId = null;
    hubState.profileLoading = false;
    hubState.profileHydrated = false;
    hubState.profileDirty = false;
    hubState.profilePreview = null;
    hubState.profilePreviewReturnFocus = null;
    hubState.socialConnectionUserId = null;
    hubState.socialIdentities = new Map();
    hubState.socialConnectionLoading = false;
    hubState.socialConnectionProvider = null;
    hubState.socialReturnHandled = false;
    hubState.socialStatus = null;
    hubState.insightRows = [];
    hubState.insightDimensions = [];
    hubState.insightsLoaded = false;
    hubState.insightDemoMode = "";
    hubState.communitySeedState = new Map();
    hubState.communityFeedError = "";
    hubState.postCommentPages = new Map();
    hubState.feed = [];
    hubState.conversations = [];
    hubState.messageDemoMode = false;
    hubState.messageDemoDismissed = false;
    hubState.messageDemoMessages = [];
    hubState.activeConversationId = null;
    hubState.activeConversationUserId = null;
    hubState.activeConversationName = "";
    hubState.activeConversationUsername = "";
    hubState.activeConversationContext = "";
    hubState.activeConversationCanSend = false;
    hubState.messages = [];
    hubState.messageHasMore = false;
    hubState.messageNextCursor = null;
    hubState.messageLoadingOlder = false;
    if(hubState.usernameSearchTimer) window.clearTimeout(hubState.usernameSearchTimer);
    hubState.usernameSearchRequest += 1;
    hubState.usernameSearchTimer = 0;
    hubState.usernameSearchLoading = false;
    hubState.usernameSuggestions = [];
    hubState.usernameSuggestionIndex = -1;
    hubState.messageAvailabilityUpdating = false;
    hubState.sendingMessage = false;
    hubState.accountDeletionRequest = null;
    hubState.accountDeletionLoading = false;
    hubState.schoolVerificationRequest = null;
    hubState.schoolVerificationLoading = false;
    hubState.schoolVerificationFiles = [];
    hubState.schoolVerificationFilePreparing = false;
    hubState.schoolVerificationEnhanced = false;
    hubState.academicEmailVerificationState = null;
    hubState.academicEmailVerificationLoading = false;
    hubState.academicEmailVerificationSending = false;
    hubState.academicEmailVerificationConfirming = false;
    if(hubState.academicEmailCooldownTimer) window.clearTimeout(hubState.academicEmailCooldownTimer);
    hubState.academicEmailCooldownTimer = 0;
    hubState.verificationEvidenceByCase = new Map();
    hubState.verificationEvidenceLoading = new Set();
    hubState.supportRequests = [];
    hubState.supportRequestsLoading = false;
    hubState.supportRequestSubmitting = false;
    hubState.adminContextUserId = null;
    hubState.adminRole = "";
    hubState.adminCapabilities = new Set();
    hubState.adminContextLoading = false;
    hubState.adminQueue = [];
    hubState.adminQueueStatus = "submitted";
    hubState.adminQueueLoading = false;
    hubState.adminQueueError = "";
    hubState.adminQueueNotice = "";
    hubState.adminQueueNoticeKind = "";
    hubState.adminReviewBusy.clear();
    hubState.ownerSummary = null;
    hubState.ownerSummaryLoading = false;
    hubState.ownerSummaryError = "";
    hubState.verificationWorkflow = "school_verification";
    hubState.verificationCounts = {};
    hubState.verificationCountsLoading = false;
    hubState.verificationCountsError = "";
    hubState.verificationCases = [];
    hubState.verificationCaseOffset = 0;
    hubState.verificationCaseHasMore = false;
    hubState.verificationTeam = [];
    hubState.verificationTeamLoading = false;
    hubState.verificationTeamError = "";
    hubState.verificationTeamBusy.clear();
    hubState.loadingFeed = false;
    hubState.loadingConversations = false;
    hubState.feedScope = "school";
    hubState.feedTopic = "all";
    hubState.feedQuery = "";
    hubState.feedMode = "all";
    hubState.feedOffset = 0;
    hubState.feedHasMore = false;
    hubState.avatarPendingBlob = null;
    hubState.avatarPendingUrl = "";
    hubState.avatarPendingMimeType = "";
    hubState.avatarPendingExtension = "";
    hubState.avatarDeleteRequested = false;
    hubState.avatarBusy = false;
    hubState.avatarOperation += 1;
    hubState.composerMedia = [];
    hubState.composerMediaBusy = false;
    hubState.mediaPrepareOperation += 1;
    hubState.publishOperation += 1;
    hubState.highlightedPostId = "";
    hubState.openCommentPostIds.clear();
    hubState.likeBusy.clear();
    hubState.bookmarkBusy.clear();
    hubState.pollBusy.clear();
    configureMessagePolling(false);
    closeHubAction(null, {restoreFocus:false});

    fillMemberProfile({});
    setProfileFormDisabled(true);
    ["communityPostBody", "communityPostTags", "communitySearch", "communityMediaInput", "chatUsername", "chatMessageInput"].forEach(id => { if($(id)) $(id).value = ""; });
    if($("communityCrossCampus")) $("communityCrossCampus").checked = false;
    resetCommunityPoll();
    renderComposerMedia();
    setCommunityComposerBusy(false);
    syncCommunityTopicControls();
    syncCommunityScopeControls();
    updateCommunityLoadMore();
    updateCommunityPostCounter();
    document.querySelectorAll("[data-community-topic]").forEach(button => {
      const active = button.dataset.communityTopic === "all";
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    ["communityFeed", "conversationList", "chatMessages", "courseInsightChart", "ownerVerificationQueue"].forEach(id => $(id)?.replaceChildren());
    renderCommunityFeed([]);
    $("courseInsightScope").value = "same_major_year";
    $("courseInsightYear").value = "";
    syncInsightYearControl();
    closeSchoolmateProfile({restoreFocus:false});
    $("schoolmateProfileLinks").replaceChildren();
    $("schoolmateProfileInterests").replaceChildren();
    $("schoolmateProfileConnections").replaceChildren();
    $("schoolmateProfileLinksSection").hidden = true;
    $("schoolmateProfileConnectionsSection").hidden = true;
    ["communityComposerStatus", "communityFeedStatus", "chatStatus", "memberProfileStatus", "avatarUploadStatus", "courseInsightStatus"].forEach(id => setStatus(id, ""));
    setSocialConnectionStatus();
    renderSocialConnections();
    renderAdminAccess();
    renderOwnerConsole();
    if($("hubAccountTrustControls")) renderAccountTrustControls();
    $("chatHeading").textContent = t("selectConversation");
    $("chatSubheading").textContent = "";
    $("chatMessageInput").disabled = true;
    $("sendChatMessage").disabled = true;
    $("reportConversation").disabled = true;
    $("blockConversationUser").disabled = true;
    $("chatUsernameSuggestions")?.replaceChildren();
    if($("chatUsernameSuggestions")) $("chatUsernameSuggestions").hidden = true;
    $("chatUsername")?.setAttribute("aria-expanded", "false");
    ["loadCourseInsights", "publishCommunityPost", "startConversation"].forEach(id => { if($(id)) $(id).disabled = false; });
    publishInstitutionContext();
  }

  function academicLabel(){
    const identity = getAcademicIdentity();
    const degree = finalTimetable?.degreeLevel || loadedAcademicProfile.degree_level || $("degreeLevel")?.value;
    const year = Number(finalTimetable?.studyYear || loadedAcademicProfile.study_year || $("studyYear")?.value || 0);
    const stage = [degree ? t(`${degree}Degree`) : "", year ? t(`studyYear${year}`) : ""].filter(Boolean).join(" · ");
    return [identity.major, stage].filter(Boolean).join(" · ") || identity.school || t("notProvided");
  }

  function initialsFor(value){
    const parts = String(value || "ConCourse").trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(part => part[0]?.toLocaleUpperCase()).join("") || "CC";
  }

  function revokeAvatarUrls(){
    if(hubState.avatarPendingUrl) URL.revokeObjectURL(hubState.avatarPendingUrl);
    hubState.avatarUrlCache.forEach(entry => URL.revokeObjectURL(entry.url));
    hubState.avatarPendingUrl = "";
    hubState.avatarUrlCache.clear();
    hubState.avatarLoadCache.clear();
  }

  function revokeCommunityMediaUrls(){
    unloadRenderedCommunityMedia();
    communityMediaObserver?.disconnect();
    hubState.composerMedia.forEach(item => { if(item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
    hubState.communityMediaUrlCache.forEach(entry => URL.revokeObjectURL(entry.url));
    hubState.composerMedia = [];
    hubState.communityMediaUrlCache.clear();
    hubState.communityMediaLoadCache.clear();
    hubState.communityVideoUrlCache.clear();
  }

  function avatarCacheKey(path, revision=0){
    return `${path || ""}::${Number(revision || 0)}`;
  }

  function avatarUrlIsLoading(url){
    for(const image of document.images){
      if(image.src === url && !image.complete) return true;
    }
    return false;
  }

  function touchAvatarUrl(key){
    const entry = hubState.avatarUrlCache.get(key);
    if(!entry) return null;
    hubState.avatarUrlCache.delete(key);
    hubState.avatarUrlCache.set(key, entry);
    return entry;
  }

  function pruneAvatarUrlCache(protectedKey=""){
    while(hubState.avatarUrlCache.size > AVATAR_URL_CACHE_LIMIT){
      let candidate = null;
      for(const [key, entry] of hubState.avatarUrlCache){
        if(key === protectedKey || avatarUrlIsLoading(entry.url)) continue;
        candidate = [key, entry];
        break;
      }
      if(!candidate) break;
      hubState.avatarUrlCache.delete(candidate[0]);
      URL.revokeObjectURL(candidate[1].url);
    }
  }

  function settleAvatarUrl(key, url, loaded){
    if(!key) return;
    const entry = hubState.avatarUrlCache.get(key);
    if(!entry || entry.url !== url){
      pruneAvatarUrlCache();
      return;
    }
    if(!loaded){
      hubState.avatarUrlCache.delete(key);
      URL.revokeObjectURL(entry.url);
    } else touchAvatarUrl(key);
    pruneAvatarUrlCache();
  }

  async function getAvatarUrl(path, revision=0){
    if(!path || !authClient || !currentUser) return "";
    const key = avatarCacheKey(path, revision);
    const cached = touchAvatarUrl(key);
    if(cached){
      pruneAvatarUrlCache(key);
      return cached.url;
    }
    if(hubState.avatarLoadCache.has(key)) return hubState.avatarLoadCache.get(key);
    const context = requestContext();
    const request = (async () => {
      const { data, error } = await authClient.storage.from("member-avatars").download(path);
      if(error || !data || !contextIsCurrent(context)) return "";
      const url = URL.createObjectURL(data);
      if(!contextIsCurrent(context)){
        URL.revokeObjectURL(url);
        return "";
      }
      hubState.avatarUrlCache.set(key, {url});
      pruneAvatarUrlCache(key);
      return url;
    })().finally(() => {
      if(hubState.avatarLoadCache.get(key) === request) hubState.avatarLoadCache.delete(key);
    });
    hubState.avatarLoadCache.set(key, request);
    return request;
  }

  function applyAvatarImage(image, initials, name, path, revision=0, directUrl=""){
    if(!image || !initials) return;
    const fallback = initialsFor(name);
    initials.textContent = fallback;
    initials.hidden = false;
    image.hidden = true;
    image.removeAttribute("src");
    const requestKey = directUrl || avatarCacheKey(path, revision);
    const cacheKey = directUrl ? "" : requestKey;
    image.dataset.avatarRequest = requestKey;
    if(!directUrl && !path) return;
    const setImage = url => {
      if(!url || image.dataset.avatarRequest !== requestKey || !image.isConnected) return;
      image.onload = () => {
        if(image.dataset.avatarRequest !== requestKey) return;
        image.hidden = false;
        initials.hidden = true;
        settleAvatarUrl(cacheKey, url, true);
      };
      image.onerror = () => {
        image.hidden = true;
        initials.hidden = false;
        settleAvatarUrl(cacheKey, url, false);
      };
      image.src = url;
    };
    if(directUrl){
      image.src = directUrl;
      image.hidden = false;
      initials.hidden = true;
      setImage(directUrl);
      return;
    }
    const cached = touchAvatarUrl(cacheKey);
    if(cached?.url){
      image.src = cached.url;
      image.hidden = false;
      initials.hidden = true;
      setImage(cached.url);
      return;
    }
    void getAvatarUrl(path, revision).then(setImage);
  }

  function renderAvatarContainer(container, name, path, revision=0){
    if(!container) return;
    container.classList.remove("has-photo");
    container.replaceChildren(document.createTextNode(initialsFor(name)));
    const image = node("img", "hub-avatar-inline-image");
    image.alt = "";
    image.hidden = true;
    container.append(image);
    const requestKey = avatarCacheKey(path, revision);
    image.dataset.avatarRequest = requestKey;
    if(!path) return;
    const cached = touchAvatarUrl(requestKey);
    if(cached?.url){
      image.src = cached.url;
      image.hidden = false;
      container.classList.add("has-photo");
      return;
    }
    void getAvatarUrl(path, revision).then(url => {
      if(!url || image.dataset.avatarRequest !== requestKey || !image.isConnected) return;
      image.onload = () => {
        image.hidden = false;
        container.classList.add("has-photo");
        settleAvatarUrl(requestKey, url, true);
      };
      image.onerror = () => {
        settleAvatarUrl(requestKey, url, false);
        image.remove();
        container.classList.remove("has-photo");
      };
      image.src = url;
    });
  }

  function createAvatar(name, path, revision=0, extraClass=""){
    const avatar = node("div", `hub-avatar${extraClass ? ` ${extraClass}` : ""}`, initialsFor(name));
    avatar.setAttribute("aria-hidden", "true");
    renderAvatarContainer(avatar, name, path, revision);
    return avatar;
  }

  function renderOwnAvatars(){
    if(!currentUser) return;
    const username = currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || t("anonymousStudent");
    const name = hubState.profile?.display_name || username;
    const path = hubState.avatarDeleteRequested ? null : hubState.profile?.avatar_path;
    const revision = hubState.profile?.avatar_revision || 0;
    applyAvatarImage($("hubUserAvatar"), $("hubUserInitials"), name, path, revision);
    renderAvatarContainer($("hubComposerInitials"), name, path, revision);
    renderAvatarContainer($("hubRailInitials"), name, path, revision);
    applyAvatarImage(
      $("profileAvatarPreview"),
      $("profileAvatarInitials"),
      name,
      path,
      revision,
      hubState.avatarPendingUrl
    );
    $("removeProfileAvatar").disabled = hubState.avatarBusy || (!path && !hubState.avatarPendingBlob);
  }

  function identityLabel(displayName, username){
    const handle = username ? `@${username}` : t("anonymousStudent");
    return displayName ? `${displayName} · ${handle}` : handle;
  }

  function renderHubHeader(){
    const view = ["community", "marketplace", "messages", "overview", "academic-tools", "profile", "owner-console"].includes(hubState.activeView) ? hubState.activeView : "community";
    const worldwideCommunity = view === "community" && hubState.feedScope === "cross";
    const worldwideMarketplace = view === "marketplace" && $("memberHub")?.dataset.marketplaceScope === "global";
    if(view === "owner-console"){
      const copy = ownerConsoleCopy();
      $("hubPageKicker").textContent = copy.kicker;
      $("hubGreeting").textContent = copy.title;
      $("hubPageIntroduction").textContent = copy.intro;
      const marketplaceActions = $("hubMarketplaceActions");
      if(marketplaceActions) marketplaceActions.hidden = true;
      scheduleHubStickyGeometry();
      return;
    }
    const prefix = view === "overview"
      ? "hubInsights"
      : view === "community"
        ? (worldwideCommunity ? "hubCommunityGlobal" : "hubCommunity")
        : view === "marketplace"
          ? (worldwideMarketplace ? "hubMarketplaceGlobal" : "hubMarketplace")
          : view === "messages"
            ? "hubMessages"
            : view === "academic-tools"
              ? "hubAcademicTools"
              : "hubProfile";
    const headingKey = view === "community"
      ? (worldwideCommunity ? "acrossCampusFeed" : "hubCommunity")
      : view === "marketplace"
        ? (worldwideMarketplace ? "hubMarketplaceGlobalTitle" : "hubMarketplace")
        : view === "messages"
          ? "hubMessages"
          : view === "academic-tools"
            ? "hubAcademicTools"
            : view === "overview"
              ? "hubInsights"
              : "hubProfile";
    $("hubPageKicker").textContent = t(`${prefix}Kicker`);
    $("hubGreeting").textContent = t(headingKey);
    $("hubPageIntroduction").textContent = t(`${prefix}Intro`);
    const marketplaceActions = $("hubMarketplaceActions");
    if(marketplaceActions) marketplaceActions.hidden = view !== "marketplace";
    scheduleHubStickyGeometry();
  }

  function isAcademicEmailVerifiedStudent(membership=hubState.membership){
    return Boolean(
      membership?.status === "verified"
      && membership?.verification_method === "academic_email"
      && membership?.verified_at
    );
  }

  function getInstitutionContext(){
    const rawStatus = String(hubState.membership?.status || "").trim().toLowerCase();
    const verified = isAcademicEmailVerifiedStudent();
    const status = verified
      ? "verified"
      : (["pending", "rejected", "revoked"].includes(rawStatus) ? rawStatus : "unverified");
    return Object.freeze({
      status,
      verified,
      schoolName:verified
        ? String(hubState.membership?.school_name || "").replace(/\s+/g, " ").trim().slice(0, 240)
        : "",
      schoolKey:verified
        ? String(hubState.membership?.school_key || "").trim().toLowerCase().slice(0, 500)
        : ""
    });
  }

  function publishInstitutionContext(){
    window.dispatchEvent(new CustomEvent("concourse:institution-context", {
      detail:getInstitutionContext()
    }));
  }

  function renderIdentity(){
    if(!currentUser) return;
    const username = currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || t("anonymousStudent");
    const name = hubState.profile?.display_name?.trim() || `@${username}`;
    $("hubUserName").textContent = name;
    $("hubUserAcademic").textContent = academicLabel();
    $("hubRailName").textContent = name;
    $("hubRailAcademic").textContent = academicLabel();
    renderOwnAvatars();
    const rawMembershipStatus = String(hubState.membership?.status || "").trim().toLocaleLowerCase();
    const membershipStatus = isAcademicEmailVerifiedStudent()
      ? "verified"
      : (["rejected", "revoked"].includes(rawMembershipStatus)
        ? rawMembershipStatus
        : (rawMembershipStatus === "verified" ? "academic-email-required" : "pending"));
    const membershipCopyKey = membershipStatus === "academic-email-required"
      ? "membershipAcademicEmailRequired"
      : `membership${membershipStatus[0].toLocaleUpperCase()}${membershipStatus.slice(1)}`;
    $("hubMembershipStatus").textContent = t(membershipCopyKey);
    $("hubMembershipStatus").className = `hub-membership-status ${membershipStatus}`;
    publishInstitutionContext();
    renderHubHeader();
    $("hubNetworkScope").textContent = membershipStatus === "verified"
      ? getInstitutionContext().schoolName || "—"
      : t(membershipStatus === "academic-email-required"
        ? "membershipAcademicEmailRequired"
        : "membershipPending");
    const strength = profileStrength();
    $("hubRailProfileStrength").textContent = `${strength}%`;
    $("hubRailProfileStrengthBar").style.width = `${strength}%`;
  }

  function profileStrength(){
    const profile = hubState.profile || {};
    const checks = [
      profile.display_name,
      profile.bio,
      Array.isArray(profile.interests) && profile.interests.length,
      profile.instagram_url,
      profile.whatsapp_url,
      profile.linkedin_url,
      profile.website_url,
      profile.avatar_path,
      profile.wechat_id,
      hubState.socialIdentities.size > 0
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }

  function renderFinalSchedule(){
    const snapshot = finalTimetable;
    const summary = snapshot?.summary || {};
    const courseList = Array.isArray(snapshot?.courses) ? snapshot.courses : [];
    const courseCount = summary.courseCount ?? courseList.length;
    const creditCount = summary.credits ?? courseList.reduce((total, course) => total + Number(course.credits || 0), 0);
    $("hubCourseCount").textContent = courseCount;
    $("hubCreditCount").textContent = creditCount;
    $("hubProfileStrength").textContent = `${profileStrength()}%`;

    const summaryContainer = $("hubFinalSummary");
    summaryContainer.replaceChildren();
    const stats = [
      [courseCount, t("coursesTakenStat")],
      [creditCount, t("creditsStat")],
      [summary.daysOnCampus ?? 0, t("daysOnCampusStat")],
      [`${Math.round(Number(summary.gapMinutes || 0) / 6) / 10}h`, t("totalGapsStat")]
    ];
    stats.forEach(([value, label]) => {
      const card = node("div", "hub-final-stat");
      card.append(node("b", "", value), node("span", "", label));
      summaryContainer.append(card);
    });

    const coursesContainer = $("hubFinalCourses");
    coursesContainer.replaceChildren();
    courseList.forEach(course => {
      const row = node("li", "hub-final-course");
      const copy = node("div");
      copy.append(node("b", "", course.name || course.code || t("notProvided")), node("small", "", [course.code, course.professor].filter(Boolean).join(" · ") || "—"));
      row.append(copy, node("span", "", `${Number(course.credits || 0)} ${t("creditsShort")}`));
      coursesContainer.append(row);
    });
    if(!courseList.length) coursesContainer.append(node("li", "hub-final-empty", t("hubNoFinalSchedule")));
  }

  function renderOverview(){
    renderIdentity();
    renderFinalSchedule();
    const year = finalTimetable?.studyYear;
    if(year && !$("courseInsightYear").value) $("courseInsightYear").value = String(year);
  }

  function syncInsightYearControl(){
    const scope = $("courseInsightScope").value;
    $("courseInsightYear").disabled = !["same_major_year", "university_year"].includes(scope);
  }

  function hideHub(){
    configureMessagePolling(false);
    window.ConCourseAcademicTools?.deactivate?.();
    window.ConCourseMarketplace?.closeTransientUi?.();
    closeSchoolmateProfile({restoreFocus:false});
    closeHubAction(null, {restoreFocus:false});
    $("memberHub").hidden = true;
    scheduleHubStickyGeometry();
    document.body.classList.remove("hub-active");
    window.syncPrimaryNavigation?.();
  }

  function showTimetable(){
    hideHub();
    window.openTimetableDestination?.();
  }

  function showHub(view="community"){
    if(!hubAccessAllowed()){
      if(currentUser) window.openTimetableDestination?.();
      else openAuthModal();
      return;
    }
    appStarted = true;
    $("appWrap").hidden = true;
    $("schedulePage").hidden = true;
    $("memberHub").hidden = false;
    document.body.classList.add("app-active", "hub-active");
    document.body.classList.remove("schedule-active");
    scheduleHubStickyGeometry();
    window.syncPrimaryNavigation?.();
    switchView(view);
    window.scrollTo({top:0, behavior:"smooth"});
  }

  async function switchView(view){
    if(!["overview", "community", "marketplace", "messages", "academic-tools", "profile", "owner-console"].includes(view)) view = "community";
    if(view === "owner-console" && !canReviewSchoolVerifications()) view = "community";
    if(view !== "academic-tools") window.ConCourseAcademicTools?.deactivate?.();
    if(view !== "community") closeSchoolmateProfile({restoreFocus:false});
    hubState.activeView = view;
    $("memberHub").dataset.activeView = view;
    renderHubHeader();
    document.querySelectorAll("[data-hub-view]").forEach(element => { element.hidden = element.dataset.hubView !== view; });
    document.querySelectorAll("[data-hub-target]").forEach(button => {
      const active = button.dataset.hubTarget === view;
      button.classList.toggle("active", active);
      if(button.hasAttribute("data-profile-entry")){
        button.setAttribute("aria-expanded", String(active));
      }
      if(button.classList.contains("hub-nav-button")){
        if(active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    });
    scheduleHubStickyGeometry();
    configureMessagePolling(view === "messages");
    if(view === "overview"){
      renderOverview();
      await loadMembership();
      if(isAcademicEmailVerifiedStudent() && !hubState.insightsLoaded) await loadCourseInsights();
      else if(!isAcademicEmailVerifiedStudent() && !hubState.insightsLoaded){
        insightEmpty(t("courseInsightUnavailable"), hubState.membershipError || t("schoolVerificationRequired"));
      }
    } else if(view === "community"){
      await Promise.all([loadCommunityFeed(), loadConversations()]);
    } else if(view === "marketplace"){
      await window.ConCourseMarketplace?.activate();
    } else if(view === "academic-tools"){
      window.ConCourseAcademicTools?.activate?.();
    } else if(view === "messages"){
      renderMessageAvailability();
      await Promise.all([loadConversations(), loadMemberProfile()]);
    } else if(view === "owner-console"){
      renderVerificationCenter();
      await loadVerificationCenterCounts({force:true});
      await Promise.all([
        hubState.verificationWorkflow === "admin_team"
          ? loadVerificationAdminTeam({force:true})
          : loadVerificationCenterQueue({force:true}),
        hasAdminCapability("owner_summary.view")
          ? loadOwnerOperationalSummary()
          : Promise.resolve(null)
      ]);
    } else if(view === "profile"){
      ensureAccountTrustControls();
      await Promise.all([
        loadMemberProfile(),
        loadSocialConnections({force:true}),
        loadSchoolVerificationRequest(),
        loadAcademicEmailVerificationState(),
        loadAccountDeletionRequest(),
        loadSupportRequests()
      ]);
    }
  }

  function messageViewIsActive(){
    return (
      document.visibilityState === "visible"
      && hubState.activeView === "messages"
      && !$("memberHub").hidden
      && !!currentUser
    );
  }

  function scheduleMessageRefresh(delay=250){
    if(hubState.messageRefreshTimer) window.clearTimeout(hubState.messageRefreshTimer);
    hubState.messageRefreshTimer = window.setTimeout(() => {
      hubState.messageRefreshTimer = 0;
      if(messageViewIsActive()) loadConversations({force:true, suppressStatus:true}).catch(console.warn);
    }, delay);
  }

  function stopMessageRealtime(){
    if(hubState.messageRefreshTimer){
      window.clearTimeout(hubState.messageRefreshTimer);
      hubState.messageRefreshTimer = 0;
    }
    const channel = hubState.messageRealtimeChannel;
    hubState.messageRealtimeChannel = null;
    hubState.messageRealtimeActive = false;
    if(channel && authClient?.removeChannel){
      Promise.resolve(authClient.removeChannel(channel)).catch(() => {});
    }
  }

  function startMessageRealtime(){
    stopMessageRealtime();
    if(!authClient?.channel || !currentUser) return;
    try {
      const channel = authClient
        .channel(`concourse-direct-messages-${currentUser.id}`)
        .on(
          "postgres_changes",
          {event:"*", schema:"public", table:"direct_messages"},
          () => scheduleMessageRefresh(160)
        )
        .on(
          "postgres_changes",
          {event:"*", schema:"public", table:"direct_conversations"},
          () => scheduleMessageRefresh(160)
        )
        .subscribe(status => {
          if(hubState.messageRealtimeChannel !== channel) return;
          hubState.messageRealtimeActive = status === "SUBSCRIBED";
          if(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)){
            hubState.messageRealtimeActive = false;
          }
        });
      hubState.messageRealtimeChannel = channel;
    } catch(error){
      hubState.messageRealtimeActive = false;
      console.warn("Realtime message updates are unavailable; polling remains active.", error);
    }
  }

  function configureMessagePolling(active){
    if(hubState.messagePoll){ clearInterval(hubState.messagePoll); hubState.messagePoll = null; }
    stopMessageRealtime();
    if(!active) return;
    startMessageRealtime();
    // Realtime is the fast path. This slower poll remains as a dependable
    // fallback when a project has not enabled the relevant Realtime tables.
    hubState.messagePoll = window.setInterval(() => {
      if(messageViewIsActive()) loadConversations({force:true, suppressStatus:true}).catch(console.warn);
    }, 30000);
  }

  async function loadMembership(){
    if(!authClient || !currentUser) return null;
    const context = requestContext();
    const { data, error } = await authClient
      .from("school_memberships")
      .select("school_name, school_key, status, verification_method, verified_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if(!contextIsCurrent(context)) return null;
    if(error){
      hubState.membershipError = featureError(error);
      hubState.membership = null;
      hubState.insightRows = [];
      hubState.insightDimensions = [];
      hubState.insightsLoaded = false;
    } else {
      hubState.membershipError = "";
      hubState.membership = data || null;
      if(!isAcademicEmailVerifiedStudent()){
        hubState.insightRows = [];
        hubState.insightDimensions = [];
        hubState.insightsLoaded = false;
      }
    }
    renderIdentity();
    return hubState.membership;
  }

  function accountTrustCopy(){
    return communitySeedText({
      en:{
        verificationTitle:"Verify Your Student Status",
        verificationDescription:"Only an approved academic email confirmed with its verification code can qualify this account as a Verified Student. A private sign-in email never counts. SSO references and student documents can support an administrator review, but cannot grant Verified Student status.",
        verificationMethod:"Choose a Verification Method",
        verificationStepProfile:"School Profile",
        verificationStepEvidence:"Verification Evidence",
        verificationStepReview:"Verified Student",
        verificationProgressLabel:"Student Verification Progress",
        verificationStepComplete:"Complete",
        verificationStepCurrent:"Current Step",
        verificationStepUpcoming:"Upcoming",
        claimedSchool:"Claimed Institution",
        verifiedSchool:"Verified Institution",
        verifiedFor:"Verified for {school}",
        accountEmail:"ConCourse Sign-In Email",
        accountEmailHelp:"Account access only. This private email does not verify student status.",
        membershipState:"Current Status",
        academicEmail:"Academic Email Code",
        academicEmailHelp:"Enter a separate institution email and confirm the eight-digit code sent to that inbox.",
        academicEmailAddress:"Academic Email Address",
        academicEmailPlaceholder:"name@university.edu",
        sendAcademicEmailCode:"Send Code",
        resendAcademicEmailCode:"Send a New Code",
        academicEmailCode:"Eight-Digit Verification Code",
        academicEmailCodePlaceholder:"00000000",
        verifyAcademicEmailCode:"Verify Code",
        academicEmailPrivacy:"This address is used only for student verification. Only an approved institutional domain and successful code confirmation can qualify the account as a Verified Student.",
        academicEmailStateLoading:"Loading your academic-email verification status…",
        academicEmailCodeWaiting:"Send a code to your academic email, then enter the eight digits below.",
        academicEmailSending:"Your verification email is being prepared…",
        academicEmailCodeSent:"Code sent to {email}. It expires in 10 minutes. Check Junk or your university quarantine if it is not in Inbox.",
        academicEmailCodeRestored:"The newest code was sent to {email}. Enter it below, or send a new code after the waiting period.",
        academicEmailConfirmedForReview:"Academic email confirmed. Your account is now recognized as a Verified Student.",
        academicEmailAwaitingCompletion:"Academic email confirmed. Verification is awaiting completion.",
        academicEmailInvalid:"Enter a valid academic email address.",
        academicEmailInvalidCode:"Enter the eight-digit code from the newest email.",
        academicEmailWrongCode:"That code is not correct. {count} attempts remain.",
        academicEmailExpired:"That code expired. Send a new code.",
        academicEmailLocked:"Too many incorrect attempts. Send a new code after the waiting period.",
        academicEmailDeliveryFailed:"The message could not be delivered. Check the address, then try again.",
        academicEmailSuperseded:"A newer code was requested. Enter the newest code or send another after the waiting period.",
        academicEmailSetupRequired:"Academic-email delivery is not active yet. Apply the academic-email migration, deploy its Edge Function, and configure a verified sender.",
        academicEmailConnectionFailed:"The verification service could not be reached. Check the function deployment and allowed website origins, then try again.",
        academicEmailAccountUnconfirmed:"Confirm your ConCourse account email before verifying a separate academic email.",
        academicEmailAlreadyVerified:"Your academic email and Verified Student status are already confirmed.",
        academicEmailUpgradeRequired:"Your previous school review does not verify student status. Confirm an approved academic email to become a Verified Student.",
        academicEmailSchoolRequired:"Use an approved academic email for your institution. Legacy accounts can be linked only when the domain maps to one supported school.",
        academicEmailInUse:"That academic email is already attached to another student-status review.",
        academicEmailReviewActive:"A student-status review is already active.",
        academicEmailResendWait:"Please wait before requesting another code.",
        verificationRetry:"Try Again",
        verificationSessionExpired:"Your session expired. Sign in again, then retry.",
        schoolProfileIncomplete:"Add or resolve your institution before Step 1 can be completed.",
        institutionSso:"Institution SSO Reference",
        institutionSsoHelp:"Provide a non-secret reference from your institution portal for administrator review. This method cannot grant Verified Student status.",
        studentDocument:"Student Document Review",
        studentDocumentHelp:"Privately submit a redacted student document for administrator review. This method cannot grant Verified Student status.",
        manualReview:"Student Document Review",
        evidenceReference:"Institution Portal Reference",
        ssoSafety:"Never enter a password, one-time code, recovery code, or authentication link.",
        verificationNote:"Optional Context for the Reviewer",
        documentType:"Document Type",
        documentStudentId:"Student ID",
        documentEnrollmentLetter:"Enrolment Letter",
        documentClassSchedule:"Current Class Schedule",
        documentPortalScreenshot:"Student Portal Screenshot",
        documentOther:"Other Enrolment Evidence",
        chooseEvidenceFiles:"Choose Private Files",
        evidenceFilesHelp:"JPG, PNG, WebP, or PDF · up to 3 files · 8 MB each.",
        evidencePrivacy:"Only you and authorised school reviewers can access these private files. Cover student numbers, birth dates, addresses, grades, QR or barcodes, and financial details. Do not upload a passport or other government ID.",
        redactionConfirmation:"I removed information that is not needed to verify enrolment.",
        selectedEvidence:"Selected Private Evidence",
        removeEvidence:"Remove",
        noEvidenceSelected:"No private files selected.",
        verificationHistory:"Request History",
        verificationHistoryEmpty:"No previous verification requests.",
        reviewerFeedback:"Reviewer Feedback",
        submittedOn:"Submitted",
        reviewedOn:"Reviewed",
        statusNotSubmitted:"Not Submitted",
        statusSubmitted:"Submitted",
        statusUnderReview:"Under Review",
        statusApproved:"Supporting Evidence Approved — Academic Email Required",
        statusVerified:"Verified",
        statusRejected:"Not Approved",
        statusWithdrawn:"Withdrawn",
        submitVerification:"Submit Verification Request",
        withdrawVerification:"Withdraw Request",
        verificationUnavailable:"Campus verification requests become available after the latest Supabase migration is applied.",
        verificationEvidenceUnavailable:"Private document review requires the Student Verification migration. Academic email and SSO review are still available.",
        verificationLoading:"Loading your campus-verification status…",
        verificationAwaiting:"Your request is awaiting administrator review.",
        verificationUnderReview:"An administrator is reviewing your request.",
        verificationApproved:"Your academic email is confirmed and your account is recognized as a Verified Student.",
        verificationApprovalSyncPending:"Your supporting review was approved, but an approved academic email and verification code are still required for Verified Student status.",
        verificationRejected:"The request was not approved. Review the administrator note before submitting new evidence.",
        verificationWithdrawn:"The previous request was withdrawn. You may submit new evidence.",
        verificationReady:"No active review request. Choose an evidence method to begin.",
        requestSubmitted:"Your campus-verification request was submitted.",
        requestWithdrawn:"Your campus-verification request was withdrawn.",
        accountTitle:"Account Deletion",
        accountDescription:"Request deletion of your profile, planner data, posts, and conversations. A seven-day safety window lets you cancel before processing. Limited security, dispute, or transaction records may be retained where legally required.",
        requestDeletion:"Request Account Deletion",
        cancelDeletion:"Cancel Deletion Request",
        deletionReason:"You may add an optional reason. Submitting starts the seven-day safety window.",
        deletionScheduled:"Deletion is scheduled for {date}. You can cancel while the request is still submitted.",
        deletionProcessing:"Your deletion request is being processed and can no longer be cancelled here.",
        deletionCancelled:"The most recent deletion request was cancelled.",
        deletionCompleted:"Account deletion has been completed.",
        deletionReady:"No active deletion request.",
        deletionUnavailable:"Account deletion requests become available after the latest Supabase migration is applied.",
        deletionRequested:"Your deletion request was submitted.",
        deletionRequestCancelled:"Your deletion request was cancelled.",
        actionFailed:"The request could not be completed. Please try again.",
        requiredReference:"Add the SSO or evidence reference before submitting.",
        requiredNote:"Add a short note describing the evidence for manual review.",
        requiredEvidence:"Choose at least one private evidence file.",
        requiredRedaction:"Confirm that unnecessary personal information has been removed.",
        evidenceFileLimit:"You can submit up to 3 private files.",
        evidenceFileTooLarge:"Each private file must be 8 MB or smaller.",
        evidenceFileType:"Choose a JPG, PNG, WebP, or PDF file.",
        evidenceFileInvalid:"The file contents do not match a supported file type.",
        evidencePreparing:"Checking private evidence…",
        evidenceUploading:"Securely uploading file {current} of {total}…",
        evidenceValidating:"Validating file {current} of {total} in the protected review service…",
        evidenceReady:"Private evidence is ready to submit.",
        evidenceValidationUnavailable:"This file could not be safely validated. Choose another file or try again later.",
        evidenceUploadFailed:"The private evidence upload could not be completed. No verification request was created.",
        supportTitle:"Support Request",
        supportDescription:"Send an access, marketplace, academic, privacy, or general request to the ConCourse team.",
        supportCategory:"Category",
        supportSubject:"Subject",
        supportDetails:"Details",
        supportSubmit:"Submit Request",
        supportLoading:"Loading your support requests…",
        supportUnavailable:"Support requests become available after the latest Supabase migration is applied.",
        supportSubmitted:"Your support request was submitted.",
        supportRequired:"Add a subject and enough detail for the team to help.",
        supportCurrent:"Your Requests",
        supportNone:"No support requests yet.",
        supportAccount:"Account",
        supportSchool:"School",
        supportMarketplace:"Marketplace",
        supportPayment:"Payment",
        supportCommunity:"Community",
        supportPrivacy:"Privacy",
        supportSafety:"Safety",
        supportTechnical:"Technical",
        supportOther:"Other",
        noValue:"Not Provided"
      },
      "zh-CN":{
        verificationTitle:"验证你的在读身份",
        verificationDescription:"只有通过验证码确认、且与院校匹配的学校邮箱，才能使账户获得“已验证学生”身份。私人登录邮箱不计入验证。学校 SSO 参考资料和学生证明文件可用于管理员审核，但不能授予“已验证学生”身份。",
        verificationMethod:"选择验证方式",
        verificationStepProfile:"学校资料",
        verificationStepEvidence:"验证资料",
        verificationStepReview:"已验证学生",
        verificationProgressLabel:"学生身份验证进度",
        verificationStepComplete:"已完成",
        verificationStepCurrent:"当前步骤",
        verificationStepUpcoming:"下一步骤",
        claimedSchool:"申报院校",
        verifiedSchool:"已验证院校",
        verifiedFor:"已验证：{school}",
        accountEmail:"ConCourse 登录邮箱",
        accountEmailHelp:"仅用于登录和账户安全；此私人邮箱不能验证学生身份。",
        membershipState:"当前状态",
        academicEmail:"学校邮箱验证码",
        academicEmailHelp:"输入独立的学校邮箱，并填写发送到该邮箱的八位验证码。",
        academicEmailAddress:"学校邮箱地址",
        academicEmailPlaceholder:"name@university.edu",
        sendAcademicEmailCode:"发送验证码",
        resendAcademicEmailCode:"发送新验证码",
        academicEmailCode:"八位验证码",
        academicEmailCodePlaceholder:"00000000",
        verifyAcademicEmailCode:"确认验证码",
        academicEmailPrivacy:"此邮箱仅用于学生身份验证。只有获准的院校邮箱域名并成功确认验证码，账户才能获得“已验证学生”身份。",
        academicEmailStateLoading:"正在加载学校邮箱验证状态…",
        academicEmailCodeWaiting:"请先向学校邮箱发送验证码，再在下方输入八位数字。",
        academicEmailSending:"正在准备学校邮箱验证邮件…",
        academicEmailCodeSent:"验证码已发送至 {email}，10 分钟内有效。若收件箱没有，请查看垃圾邮件或学校隔离区。",
        academicEmailCodeRestored:"最新验证码已发送至 {email}。请在下方输入；等待期结束后也可以发送新验证码。",
        academicEmailConfirmedForReview:"学校邮箱已确认，你的账户现在已获得“已验证学生”身份。",
        academicEmailAwaitingCompletion:"学校邮箱已确认，正在等待验证流程完成。",
        academicEmailInvalid:"请输入有效的学校邮箱地址。",
        academicEmailInvalidCode:"请输入最新邮件中的八位验证码。",
        academicEmailWrongCode:"验证码不正确，还可尝试 {count} 次。",
        academicEmailExpired:"验证码已过期，请发送新验证码。",
        academicEmailLocked:"错误次数过多，请在等待期后发送新验证码。",
        academicEmailDeliveryFailed:"邮件未能送达。请检查地址后重试。",
        academicEmailSuperseded:"你已申请更新的验证码。请输入最新验证码，或在等待期结束后重新发送。",
        academicEmailSetupRequired:"学校邮箱发送功能尚未启用。请应用学校邮箱迁移、部署 Edge Function，并配置已验证的发件人。",
        academicEmailConnectionFailed:"无法连接学校邮箱验证服务。请检查函数部署和允许的网站来源后重试。",
        academicEmailAccountUnconfirmed:"请先确认 ConCourse 账户邮箱，再验证独立的学校邮箱。",
        academicEmailAlreadyVerified:"你的学校邮箱及“已验证学生”身份已经确认。",
        academicEmailUpgradeRequired:"之前的学校审核不能验证学生身份。请确认获准的学校邮箱，成为“已验证学生”。",
        academicEmailSchoolRequired:"请使用与院校匹配的获准学校邮箱。旧账户只有在域名唯一对应受支持院校时才可建立待审核关联。",
        academicEmailInUse:"此学校邮箱已用于另一份在读身份审核。",
        academicEmailReviewActive:"已有一份在读身份审核正在进行。",
        academicEmailResendWait:"请稍候再发送新的验证码。",
        verificationRetry:"重试",
        verificationSessionExpired:"登录状态已过期。请重新登录后再试。",
        schoolProfileIncomplete:"请先补充或确认院校，才能完成第一步。",
        institutionSso:"学校 SSO 参考资料",
        institutionSsoHelp:"提供学校门户中的非敏感参考资料，供管理员审核。此方式不能授予“已验证学生”身份。",
        studentDocument:"学生证明文件审核",
        studentDocumentHelp:"私密提交已遮盖敏感信息的学生证明，供管理员审核。此方式不能授予“已验证学生”身份。",
        manualReview:"学生证明文件审核",
        evidenceReference:"学校门户参考资料",
        ssoSafety:"切勿输入密码、一次性验证码、恢复码或身份验证链接。",
        verificationNote:"给审核员的补充说明（选填）",
        documentType:"文件类型",
        documentStudentId:"学生证",
        documentEnrollmentLetter:"在读证明",
        documentClassSchedule:"本学期课表",
        documentPortalScreenshot:"学生门户截图",
        documentOther:"其他在读证明",
        chooseEvidenceFiles:"选择私密文件",
        evidenceFilesHelp:"支持 JPG、PNG、WebP 或 PDF；最多 3 份；每份不超过 8 MB。",
        evidencePrivacy:"只有你和获授权的学校审核员可以查看这些私密文件。请遮盖学号、出生日期、地址、成绩、二维码／条形码及财务信息。请勿上传护照或其他政府签发的身份证件。",
        redactionConfirmation:"我已遮盖与验证在读身份无关的信息。",
        selectedEvidence:"已选择的私密证明",
        removeEvidence:"移除",
        noEvidenceSelected:"尚未选择私密文件。",
        verificationHistory:"申请记录",
        verificationHistoryEmpty:"尚无验证申请记录。",
        reviewerFeedback:"审核员说明",
        submittedOn:"提交时间",
        reviewedOn:"审核时间",
        statusNotSubmitted:"未提交",
        statusSubmitted:"已提交",
        statusUnderReview:"审核中",
        statusApproved:"辅助资料已批准——仍须验证学校邮箱",
        statusVerified:"已验证",
        statusRejected:"未获批准",
        statusWithdrawn:"已撤回",
        submitVerification:"提交验证申请",
        withdrawVerification:"撤回申请",
        verificationUnavailable:"应用最新 Supabase 迁移后即可提交校园身份审核申请。",
        verificationEvidenceUnavailable:"私密文件审核需要应用“学生验证”迁移。学校邮箱和 SSO 审核仍可使用。",
        verificationLoading:"正在加载校园身份审核状态…",
        verificationAwaiting:"申请正在等待管理员审核。",
        verificationUnderReview:"管理员正在审核你的申请。",
        verificationApproved:"你的学校邮箱已确认，账户现已获得“已验证学生”身份。",
        verificationApprovalSyncPending:"辅助资料审核已获批准，但仍须使用获准的学校邮箱完成验证码确认，才能获得“已验证学生”身份。",
        verificationRejected:"申请未获批准。请先查看管理员说明，再提交新的证明。",
        verificationWithdrawn:"上一份申请已撤回，你可以提交新的证明。",
        verificationReady:"目前没有进行中的审核。请选择证明方式。",
        requestSubmitted:"校园身份审核申请已提交。",
        requestWithdrawn:"校园身份审核申请已撤回。",
        accountTitle:"删除账户",
        accountDescription:"申请删除个人资料、规划数据、帖子和私信。处理前有七天安全期可取消；法律要求下可能保留少量安全、争议或交易记录。",
        requestDeletion:"申请删除账户",
        cancelDeletion:"取消删除申请",
        deletionReason:"可填写原因（选填）。提交后将进入七天安全期。",
        deletionScheduled:"账户计划于 {date} 删除。申请仍为已提交状态时可以取消。",
        deletionProcessing:"删除申请正在处理，已无法在此取消。",
        deletionCancelled:"最近一次删除申请已取消。",
        deletionCompleted:"账户删除已经完成。",
        deletionReady:"目前没有进行中的删除申请。",
        deletionUnavailable:"应用最新 Supabase 迁移后即可提交账户删除申请。",
        deletionRequested:"账户删除申请已提交。",
        deletionRequestCancelled:"账户删除申请已取消。",
        actionFailed:"暂时无法完成申请，请重试。",
        requiredReference:"提交前请填写 SSO 或证明资料。",
        requiredNote:"请简要说明用于人工审核的证明。",
        requiredEvidence:"请至少选择一份私密证明文件。",
        requiredRedaction:"请确认已遮盖不必要的个人信息。",
        evidenceFileLimit:"最多可提交 3 份私密文件。",
        evidenceFileTooLarge:"每份私密文件不得超过 8 MB。",
        evidenceFileType:"请选择 JPG、PNG、WebP 或 PDF 文件。",
        evidenceFileInvalid:"文件内容与支持的文件类型不符。",
        evidencePreparing:"正在检查私密证明…",
        evidenceUploading:"正在安全上传第 {current}／{total} 份文件…",
        evidenceValidating:"正在通过受保护的审核服务验证第 {current}／{total} 份文件…",
        evidenceReady:"私密证明已准备好提交。",
        evidenceValidationUnavailable:"无法安全验证此文件。请选择其他文件或稍后重试。",
        evidenceUploadFailed:"无法完成私密证明上传，验证申请尚未创建。",
        supportTitle:"支持申请",
        supportDescription:"向 ConCourse 团队提交账户访问、市集、学术、隐私或一般问题。",
        supportCategory:"类别",
        supportSubject:"主题",
        supportDetails:"详情",
        supportSubmit:"提交申请",
        supportLoading:"正在加载你的支持申请…",
        supportUnavailable:"应用最新 Supabase 迁移后即可使用支持申请。",
        supportSubmitted:"支持申请已提交。",
        supportRequired:"请填写主题和足够的详情，以便团队协助。",
        supportCurrent:"你的申请",
        supportNone:"暂时没有支持申请。",
        supportAccount:"账户",
        supportSchool:"学校",
        supportMarketplace:"校园市集",
        supportPayment:"付款",
        supportCommunity:"校园社区",
        supportPrivacy:"隐私",
        supportSafety:"安全",
        supportTechnical:"技术问题",
        supportOther:"其他",
        noValue:"未提供"
      },
      "zh-HK":{
        verificationTitle:"驗證你嘅在讀身份",
        verificationDescription:"只有用驗證碼確認、而且同院校相符嘅院校電郵，先可以令帳戶成為「已驗證學生」。私人登入電郵唔計入驗證。院校 SSO 參考資料同學生證明文件可以支援管理員審核，但唔可以授予「已驗證學生」身份。",
        verificationMethod:"選擇驗證方式",
        verificationStepProfile:"院校資料",
        verificationStepEvidence:"驗證資料",
        verificationStepReview:"已驗證學生",
        verificationProgressLabel:"學生身份驗證進度",
        verificationStepComplete:"已完成",
        verificationStepCurrent:"目前步驟",
        verificationStepUpcoming:"下一步驟",
        claimedSchool:"申報院校",
        verifiedSchool:"已驗證院校",
        verifiedFor:"已驗證：{school}",
        accountEmail:"ConCourse 登入電郵",
        accountEmailHelp:"只用於登入同帳戶安全；呢個私人電郵唔會驗證學生身份。",
        membershipState:"目前狀態",
        academicEmail:"院校電郵驗證碼",
        academicEmailHelp:"輸入獨立嘅院校電郵，然後填寫傳送到該信箱嘅八位驗證碼。",
        academicEmailAddress:"院校電郵地址",
        academicEmailPlaceholder:"name@university.edu",
        sendAcademicEmailCode:"傳送驗證碼",
        resendAcademicEmailCode:"傳送新驗證碼",
        academicEmailCode:"八位驗證碼",
        academicEmailCodePlaceholder:"00000000",
        verifyAcademicEmailCode:"確認驗證碼",
        academicEmailPrivacy:"呢個電郵只會用作學生身份驗證。只有獲准嘅院校電郵網域同成功確認驗證碼，先可以令帳戶成為「已驗證學生」。",
        academicEmailStateLoading:"正在載入院校電郵驗證狀態…",
        academicEmailCodeWaiting:"請先將驗證碼傳送到院校電郵，再喺下面輸入八位數字。",
        academicEmailSending:"正在準備院校電郵驗證郵件…",
        academicEmailCodeSent:"驗證碼已傳送到 {email}，10 分鐘內有效。如果收件箱冇收到，請查看垃圾郵件或院校隔離區。",
        academicEmailCodeRestored:"最新驗證碼已傳送到 {email}。請喺下面輸入；等候期完咗亦可以傳送新驗證碼。",
        academicEmailConfirmedForReview:"院校電郵已確認，你嘅帳戶而家已成為「已驗證學生」。",
        academicEmailAwaitingCompletion:"院校電郵已確認，正等候驗證流程完成。",
        academicEmailInvalid:"請輸入有效嘅院校電郵地址。",
        academicEmailInvalidCode:"請輸入最新電郵入面嘅八位驗證碼。",
        academicEmailWrongCode:"驗證碼唔正確，仲可以試 {count} 次。",
        academicEmailExpired:"驗證碼已過期，請傳送新驗證碼。",
        academicEmailLocked:"錯誤次數太多，請喺等候期之後傳送新驗證碼。",
        academicEmailDeliveryFailed:"電郵未能送達。請檢查地址之後再試。",
        academicEmailSuperseded:"你已經申請咗更新嘅驗證碼。請輸入最新驗證碼，或者等候期完咗再傳送。",
        academicEmailSetupRequired:"院校電郵傳送功能未啟用。請套用院校電郵遷移、部署 Edge Function，並設定已驗證嘅寄件人。",
        academicEmailConnectionFailed:"未能連接院校電郵驗證服務。請檢查函數部署同獲准網站來源，然後再試。",
        academicEmailAccountUnconfirmed:"請先確認 ConCourse 帳戶電郵，再驗證另一個院校電郵。",
        academicEmailAlreadyVerified:"你嘅院校電郵同「已驗證學生」身份已經確認。",
        academicEmailUpgradeRequired:"之前嘅院校審核唔會驗證學生身份。請確認獲准嘅院校電郵，成為「已驗證學生」。",
        academicEmailSchoolRequired:"請使用同院校相符嘅獲准電郵。舊帳戶只有喺網域唯一對應受支援院校時先可以建立待審核連結。",
        academicEmailInUse:"呢個院校電郵已用於另一份在讀身份審核。",
        academicEmailReviewActive:"已經有一份在讀身份審核進行中。",
        academicEmailResendWait:"請等一陣先再傳送新驗證碼。",
        verificationRetry:"再試一次",
        verificationSessionExpired:"登入狀態已過期。請重新登入後再試。",
        schoolProfileIncomplete:"請先補充或確認院校，先可以完成第一步。",
        institutionSso:"院校 SSO 參考資料",
        institutionSsoHelp:"提供院校門戶內嘅非敏感參考資料，畀管理員審核。呢個方式唔可以授予「已驗證學生」身份。",
        studentDocument:"學生證明文件審核",
        studentDocumentHelp:"私密提交已遮蓋敏感資料嘅學生證明，畀管理員審核。呢個方式唔可以授予「已驗證學生」身份。",
        manualReview:"學生證明文件審核",
        evidenceReference:"院校門戶參考資料",
        ssoSafety:"切勿輸入密碼、一次性驗證碼、復原碼或身份驗證連結。",
        verificationNote:"畀審核員嘅補充說明（選填）",
        documentType:"文件類型",
        documentStudentId:"學生證",
        documentEnrollmentLetter:"在讀證明",
        documentClassSchedule:"本學期時間表",
        documentPortalScreenshot:"學生門戶截圖",
        documentOther:"其他在讀證明",
        chooseEvidenceFiles:"選擇私密文件",
        evidenceFilesHelp:"支援 JPG、PNG、WebP 或 PDF；最多 3 份；每份不超過 8 MB。",
        evidencePrivacy:"只有你同獲授權嘅院校審核員可以查看呢啲私密文件。請遮蓋學號、出生日期、地址、成績、二維碼／條碼同財務資料。請勿上載護照或其他政府簽發嘅身份證明文件。",
        redactionConfirmation:"我已遮蓋同驗證在讀身份無關嘅資料。",
        selectedEvidence:"已選擇嘅私密證明",
        removeEvidence:"移除",
        noEvidenceSelected:"未有選擇私密文件。",
        verificationHistory:"申請記錄",
        verificationHistoryEmpty:"未有驗證申請記錄。",
        reviewerFeedback:"審核員說明",
        submittedOn:"提交時間",
        reviewedOn:"審核時間",
        statusNotSubmitted:"未提交",
        statusSubmitted:"已提交",
        statusUnderReview:"審核中",
        statusApproved:"輔助資料已批准——仍要驗證院校電郵",
        statusVerified:"已驗證",
        statusRejected:"未獲批准",
        statusWithdrawn:"已撤回",
        submitVerification:"提交驗證申請",
        withdrawVerification:"撤回申請",
        verificationUnavailable:"套用最新 Supabase 遷移後就可以提交校園身份審核申請。",
        verificationEvidenceUnavailable:"私密文件審核需要套用「學生驗證」遷移。院校電郵同 SSO 審核仍然可以使用。",
        verificationLoading:"正在載入校園身份審核狀態…",
        verificationAwaiting:"申請正等候管理員審核。",
        verificationUnderReview:"管理員正審核你嘅申請。",
        verificationApproved:"你嘅院校電郵已確認，帳戶而家已成為「已驗證學生」。",
        verificationApprovalSyncPending:"輔助資料審核已獲批准，但仍然要用獲准嘅院校電郵完成驗證碼確認，先可以成為「已驗證學生」。",
        verificationRejected:"申請未獲批准。請先查看管理員說明，再提交新證明。",
        verificationWithdrawn:"上一份申請已撤回，你可以提交新證明。",
        verificationReady:"目前無進行中嘅審核。請選擇證明方式。",
        requestSubmitted:"校園身份審核申請已提交。",
        requestWithdrawn:"校園身份審核申請已撤回。",
        accountTitle:"刪除帳戶",
        accountDescription:"申請刪除個人資料、規劃數據、帖文同私訊。處理前有七日安全期可以取消；法律要求下或會保留少量安全、爭議或交易記錄。",
        requestDeletion:"申請刪除帳戶",
        cancelDeletion:"取消刪除申請",
        deletionReason:"可以填寫原因（選填）。提交後會進入七日安全期。",
        deletionScheduled:"帳戶預定於 {date} 刪除。申請仍然係已提交狀態時可以取消。",
        deletionProcessing:"刪除申請正處理中，已經唔可以喺呢度取消。",
        deletionCancelled:"最近一次刪除申請已取消。",
        deletionCompleted:"帳戶刪除已經完成。",
        deletionReady:"目前無進行中嘅刪除申請。",
        deletionUnavailable:"套用最新 Supabase 遷移後就可以提交帳戶刪除申請。",
        deletionRequested:"帳戶刪除申請已提交。",
        deletionRequestCancelled:"帳戶刪除申請已取消。",
        actionFailed:"暫時未能完成申請，請再試。",
        requiredReference:"提交前請填寫 SSO 或證明資料。",
        requiredNote:"請簡短說明用作人手審核嘅證明。",
        requiredEvidence:"請至少選擇一份私密證明文件。",
        requiredRedaction:"請確認已遮蓋不必要嘅個人資料。",
        evidenceFileLimit:"最多可以提交 3 份私密文件。",
        evidenceFileTooLarge:"每份私密文件唔可以超過 8 MB。",
        evidenceFileType:"請選擇 JPG、PNG、WebP 或 PDF 文件。",
        evidenceFileInvalid:"文件內容同支援嘅文件類型不符。",
        evidencePreparing:"正在檢查私密證明…",
        evidenceUploading:"正在安全上載第 {current}／{total} 份文件…",
        evidenceValidating:"正在透過受保護嘅審核服務驗證第 {current}／{total} 份文件…",
        evidenceReady:"私密證明已準備好提交。",
        evidenceValidationUnavailable:"未能安全驗證呢份文件。請選擇其他文件或稍後再試。",
        evidenceUploadFailed:"未能完成私密證明上載，驗證申請尚未建立。",
        supportTitle:"支援申請",
        supportDescription:"向 ConCourse 團隊提交帳戶存取、市集、學術、私隱或一般問題。",
        supportCategory:"類別",
        supportSubject:"主題",
        supportDetails:"詳情",
        supportSubmit:"提交申請",
        supportLoading:"正在載入你嘅支援申請…",
        supportUnavailable:"套用最新 Supabase 遷移後就可以使用支援申請。",
        supportSubmitted:"支援申請已提交。",
        supportRequired:"請填寫主題同足夠詳情，等團隊可以協助。",
        supportCurrent:"你嘅申請",
        supportNone:"暫時無支援申請。",
        supportAccount:"帳戶",
        supportSchool:"學校",
        supportMarketplace:"校園市集",
        supportPayment:"付款",
        supportCommunity:"校園社群",
        supportPrivacy:"私隱",
        supportSafety:"安全",
        supportTechnical:"技術問題",
        supportOther:"其他",
        noValue:"未提供"
      }
    });
  }

  function ownerConsoleCopy(){
    return communitySeedText({
      en:{
        nav:"Verification Center",
        kicker:"ConCourse Trust Operations",
        title:"Verification Center",
        intro:"Review identity, marketplace, safety, privacy, and support requests through protected administrator workflows.",
        ownerRole:"Owner",
        reviewerRole:"Reviewer",
        access:"{role} Access",
        queueKicker:"Protected Review Queue",
        queueTitle:"School Identity",
        queueDescription:"Review submitted evidence and record a clear, auditable decision.",
        summaryKicker:"Operations",
        summaryTitle:"Platform Summary",
        summaryRefresh:"Refresh Summary",
        summaryLoading:"Loading protected operational totals…",
        summaryUnavailable:"The operational summary is temporarily unavailable.",
        summaryAccounts:"Accounts",
        summaryVerification:"School Verification",
        summaryDeletion:"Deletion Requests",
        summaryCommunity:"Community",
        summaryMarketplace:"Marketplace",
        summaryMessaging:"Messaging",
        requestStatus:"Request Status",
        statusSubmitted:"Submitted",
        statusUnderReview:"Under Review",
        statusApproved:"Approved",
        statusRejected:"Rejected",
        statusWithdrawn:"Withdrawn",
        refresh:"Refresh Queue",
        loading:"Loading protected verification requests…",
        unavailable:"The Verification Center is unavailable. Apply the latest administrator migration, then try again.",
        denied:"This account does not have permission to open the Verification Center.",
        queueClear:"Queue Clear",
        noRequests:"There are no requests with this status.",
        account:"Account",
        school:"School",
        schoolKey:"School Key",
        evidenceMethod:"Evidence Method",
        evidenceReference:"Evidence Reference",
        privateEvidence:"Private Student Evidence",
        loadEvidence:"Review Private Evidence",
        evidenceLoading:"Loading protected evidence…",
        evidenceNone:"No private files are attached to this request.",
        openEvidence:"Open Securely",
        evidenceOpenFailed:"The protected file could not be opened. Confirm your reviewer access and try again.",
        evidencePrivacyNote:"Links are created only when requested and expire after 60 seconds. Files pass structural safety checks, not antivirus scanning. Use a managed device and do not copy or retain evidence outside the review workflow.",
        applicantNote:"Applicant Note",
        submittedAt:"Submitted",
        reviewedAt:"Reviewed",
        reviewerNote:"Reviewer Note",
        noValue:"Not provided",
        academicEmail:"Academic Email",
        institutionSso:"Institution SSO",
        manualReview:"Manual Review",
        decisionMethod:"Verification Method",
        notePlaceholder:"Add a clear note for the applicant and the audit record.",
        approve:"Approve",
        reject:"Reject",
        approveTitle:"Approve Campus Identity",
        approveConfirm:"Approve this request and grant verified-campus access?",
        rejectTitle:"Reject Campus Identity",
        rejectConfirm:"Reject this request? The applicant will be able to see your reviewer note before resubmitting.",
        rejectNoteRequired:"Add a reviewer note before rejecting this request.",
        savingDecision:"Saving the review decision…",
        approved:"The campus identity was approved.",
        rejected:"The campus identity was rejected.",
        decisionFailed:"The review decision could not be saved. Please try again.",
        statusLabel:"Status",
        statusAll:"All Statuses",
        statusOpen:"Open",
        statusReviewing:"Reviewing",
        statusVerified:"Verified",
        statusEvidenceAccepted:"Evidence Accepted",
        statusCancelled:"Cancelled",
        statusProcessing:"Processing",
        statusCompleted:"Completed",
        statusResolved:"Resolved",
        statusDismissed:"Dismissed",
        statusAwaitingUser:"Waiting for User",
        statusClosed:"Closed",
        statusResolvedBuyer:"Resolved for Buyer",
        statusResolvedSeller:"Resolved for Seller",
        workflowSchool:"School Identity",
        workflowPayments:"Payments",
        workflowDisputes:"Disputes",
        workflowMarketReports:"Market Reports",
        workflowContentReports:"Safety Reports",
        workflowDeletion:"Account & Privacy",
        workflowSupport:"Other Requests",
        workflowTeam:"Admin Team",
        workflowSchoolDescription:"Review school evidence before granting verified-campus access.",
        workflowPaymentsDescription:"Review user-submitted payment evidence and provider-state exceptions. Provider payment truth remains server controlled.",
        workflowDisputesDescription:"Review protected marketplace disputes and record a resolution.",
        workflowMarketReportsDescription:"Review reports about listings and marketplace conduct.",
        workflowContentReportsDescription:"Review reports about posts, comments, messages, and users.",
        workflowDeletionDescription:"Process account deletion and privacy requests with an auditable record.",
        workflowSupportDescription:"Respond to access, marketplace, academic, and general support requests.",
        caseReference:"Case",
        requester:"Requester",
        created:"Created",
        updated:"Updated",
        order:"Order",
        listing:"Listing",
        amount:"Amount",
        paymentState:"Provider State",
        provider:"Provider",
        reason:"Reason",
        details:"Details",
        category:"Category",
        subject:"Subject",
        priority:"Priority",
        decisionNote:"Review Note",
        decisionNotePlaceholder:"Explain the decision clearly for the requester and audit record.",
        noteRequired:"Add a review note before completing this action.",
        actionUnderReview:"Start Review",
        actionAcceptEvidence:"Accept Evidence",
        actionRecommendRefund:"Recommend Buyer Refund",
        actionRecommendRelease:"Recommend Seller Release",
        actionReturnToQueue:"Return to Queue",
        actionRequestInfo:"Request Information",
        actionApprove:"Approve",
        actionReject:"Reject",
        actionVerify:"Verify Evidence",
        actionResolve:"Resolve",
        actionResolveBuyer:"Resolve for Buyer",
        actionResolveSeller:"Resolve for Seller",
        actionClose:"Close",
        actionDismiss:"Dismiss",
        actionProcessing:"Mark Processing",
        actionComplete:"Complete",
        actionCancel:"Cancel Request",
        actionEscalate:"Escalate",
        actionConfirmTitle:"Confirm Review Action",
        actionConfirm:"Apply “{action}” to this case?",
        actionSaved:"The case was updated.",
        teamKicker:"Access Control",
        teamTitle:"Appointed Admins",
        teamDescription:"Appoint trusted administrators and give each person only the review scopes they need.",
        teamIdentifier:"Confirmed Account Email",
        teamRole:"Role",
        teamScopes:"Allowed Workflows",
        teamAppoint:"Appoint Admin",
        teamSave:"Save Access",
        teamRevoke:"Revoke Access",
        teamLoading:"Loading appointed administrators…",
        teamEmptyTitle:"No Appointed Admins",
        teamEmptyDescription:"Appoint an administrator when you are ready to delegate a workflow.",
        teamIdentifierRequired:"Enter the administrator’s confirmed account email.",
        teamScopeRequired:"Choose at least one workflow.",
        teamAppointed:"The administrator was appointed.",
        teamUpdated:"The administrator access was updated.",
        teamRevoked:"The administrator access was revoked.",
        teamUnavailable:"The administrator team is temporarily unavailable.",
        revokeConfirm:"Revoke this administrator’s Verification Center access?",
        privacyRole:"Privacy Administrator"
      },
      "zh-CN":{
        nav:"审核中心",
        kicker:"ConCourse 信任运营",
        title:"审核中心",
        intro:"通过受保护的管理员工作流程审核身份、市集、安全、隐私和用户支持申请。",
        ownerRole:"所有者",
        reviewerRole:"审核员",
        access:"{role}权限",
        queueKicker:"受保护审核队列",
        queueTitle:"校园身份",
        queueDescription:"核对用户提交的证明，并记录清晰、可审计的决定。",
        summaryKicker:"运营概览",
        summaryTitle:"平台摘要",
        summaryRefresh:"刷新摘要",
        summaryLoading:"正在加载受保护的运营统计…",
        summaryUnavailable:"运营摘要暂时不可用。",
        summaryAccounts:"账户",
        summaryVerification:"校园认证",
        summaryDeletion:"删除申请",
        summaryCommunity:"校园社区",
        summaryMarketplace:"校园市集",
        summaryMessaging:"私信",
        requestStatus:"申请状态",
        statusSubmitted:"已提交",
        statusUnderReview:"审核中",
        statusApproved:"已批准",
        statusRejected:"已拒绝",
        statusWithdrawn:"已撤回",
        refresh:"刷新队列",
        loading:"正在加载受保护的审核申请…",
        unavailable:"审核中心暂不可用。请应用最新管理员迁移后重试。",
        denied:"此账户无权打开审核中心。",
        queueClear:"队列已清空",
        noRequests:"没有处于此状态的申请。",
        account:"账户",
        school:"学校",
        schoolKey:"学校标识",
        evidenceMethod:"证明方式",
        evidenceReference:"证明资料",
        privateEvidence:"私密学生证明",
        loadEvidence:"查看私密证明",
        evidenceLoading:"正在加载受保护的证明…",
        evidenceNone:"此申请没有附加私密文件。",
        openEvidence:"安全打开",
        evidenceOpenFailed:"无法打开受保护文件。请确认审核权限后重试。",
        evidencePrivacyNote:"文件链接仅在需要时生成，并在 60 秒后失效。文件已通过结构安全检查，但并非病毒扫描。请使用受管理的设备，且不要在审核流程外复制或保留证明。",
        applicantNote:"申请人说明",
        submittedAt:"提交时间",
        reviewedAt:"审核时间",
        reviewerNote:"审核说明",
        noValue:"未提供",
        academicEmail:"学校邮箱",
        institutionSso:"学校 SSO",
        manualReview:"人工审核",
        decisionMethod:"认证方式",
        notePlaceholder:"为申请人和审核记录填写清晰说明。",
        approve:"批准",
        reject:"拒绝",
        approveTitle:"批准校园身份",
        approveConfirm:"批准此申请并授予认证校园功能访问权？",
        rejectTitle:"拒绝校园身份",
        rejectConfirm:"拒绝此申请？申请人重新提交前会看到你的审核说明。",
        rejectNoteRequired:"拒绝申请前请填写审核说明。",
        savingDecision:"正在保存审核决定…",
        approved:"校园身份已批准。",
        rejected:"校园身份已拒绝。",
        decisionFailed:"无法保存审核决定，请重试。",
        statusLabel:"状态",
        statusAll:"全部状态",
        statusOpen:"待处理",
        statusReviewing:"审核中",
        statusVerified:"已核验",
        statusEvidenceAccepted:"证据已接受",
        statusCancelled:"已取消",
        statusProcessing:"处理中",
        statusCompleted:"已完成",
        statusResolved:"已解决",
        statusDismissed:"已驳回",
        statusAwaitingUser:"等待用户",
        statusClosed:"已关闭",
        statusResolvedBuyer:"支持买家",
        statusResolvedSeller:"支持卖家",
        workflowSchool:"校园身份",
        workflowPayments:"付款凭证",
        workflowDisputes:"交易争议",
        workflowMarketReports:"市集举报",
        workflowContentReports:"安全举报",
        workflowDeletion:"账户与隐私",
        workflowSupport:"其他申请",
        workflowTeam:"管理员团队",
        workflowSchoolDescription:"审核学校证明，再授予校园认证功能访问权。",
        workflowPaymentsDescription:"审核用户提交的付款凭证和支付状态异常。支付平台状态仍由服务器控制。",
        workflowDisputesDescription:"审核受保护交易争议并记录处理结果。",
        workflowMarketReportsDescription:"审核商品和市集行为举报。",
        workflowContentReportsDescription:"审核帖子、评论、私信和用户举报。",
        workflowDeletionDescription:"以可审计方式处理账户删除和隐私申请。",
        workflowSupportDescription:"处理访问、市集、学术和一般支持申请。",
        caseReference:"个案",
        requester:"申请人",
        created:"创建时间",
        updated:"更新时间",
        order:"订单",
        listing:"商品",
        amount:"金额",
        paymentState:"支付平台状态",
        provider:"支付平台",
        reason:"原因",
        details:"详情",
        category:"类别",
        subject:"主题",
        priority:"优先级",
        decisionNote:"审核说明",
        decisionNotePlaceholder:"为申请人和审计记录清楚说明决定。",
        noteRequired:"完成此操作前请填写审核说明。",
        actionUnderReview:"开始审核",
        actionAcceptEvidence:"接受付款凭证",
        actionRecommendRefund:"建议向买家退款",
        actionRecommendRelease:"建议向卖家放款",
        actionReturnToQueue:"退回待处理队列",
        actionRequestInfo:"要求补充资料",
        actionApprove:"批准",
        actionReject:"拒绝",
        actionVerify:"核验凭证",
        actionResolve:"解决",
        actionResolveBuyer:"支持买家",
        actionResolveSeller:"支持卖家",
        actionClose:"关闭",
        actionDismiss:"驳回",
        actionProcessing:"标记处理中",
        actionComplete:"完成",
        actionCancel:"取消申请",
        actionEscalate:"升级处理",
        actionConfirmTitle:"确认审核操作",
        actionConfirm:"确定对该个案执行“{action}”吗？",
        actionSaved:"个案已更新。",
        teamKicker:"访问控制",
        teamTitle:"受委任管理员",
        teamDescription:"委任可信管理员，并仅授予其所需的审核权限。",
        teamIdentifier:"已确认的账户邮箱",
        teamRole:"角色",
        teamScopes:"允许的工作流程",
        teamAppoint:"委任管理员",
        teamSave:"保存权限",
        teamRevoke:"撤销权限",
        teamLoading:"正在加载管理员团队…",
        teamEmptyTitle:"暂无受委任管理员",
        teamEmptyDescription:"需要分派审核工作时，可在此委任管理员。",
        teamIdentifierRequired:"请输入管理员已确认的账户邮箱。",
        teamScopeRequired:"请至少选择一个工作流程。",
        teamAppointed:"管理员已委任。",
        teamUpdated:"管理员权限已更新。",
        teamRevoked:"管理员权限已撤销。",
        teamUnavailable:"管理员团队暂时不可用。",
        revokeConfirm:"撤销此管理员的审核中心权限？",
        privacyRole:"隐私管理员"
      },
      "zh-HK":{
        nav:"審核中心",
        kicker:"ConCourse 信任營運",
        title:"審核中心",
        intro:"透過受保護嘅管理員工作流程，審核身份、市集、安全、私隱同用戶支援申請。",
        ownerRole:"擁有人",
        reviewerRole:"審核員",
        access:"{role}權限",
        queueKicker:"受保護審核隊列",
        queueTitle:"校園身份",
        queueDescription:"核對用戶提交嘅證明，並記錄清晰、可審計嘅決定。",
        summaryKicker:"營運概覽",
        summaryTitle:"平台摘要",
        summaryRefresh:"重新整理摘要",
        summaryLoading:"正在載入受保護嘅營運統計…",
        summaryUnavailable:"營運摘要暫時未能使用。",
        summaryAccounts:"帳戶",
        summaryVerification:"校園驗證",
        summaryDeletion:"刪除申請",
        summaryCommunity:"校園社群",
        summaryMarketplace:"校園市集",
        summaryMessaging:"私訊",
        requestStatus:"申請狀態",
        statusSubmitted:"已提交",
        statusUnderReview:"審核中",
        statusApproved:"已批准",
        statusRejected:"已拒絕",
        statusWithdrawn:"已撤回",
        refresh:"重新整理隊列",
        loading:"正在載入受保護嘅審核申請…",
        unavailable:"審核中心暫時未能使用。請套用最新管理員遷移後再試。",
        denied:"呢個帳戶無權開啟審核中心。",
        queueClear:"隊列已清空",
        noRequests:"無申請處於呢個狀態。",
        account:"帳戶",
        school:"院校",
        schoolKey:"院校識別碼",
        evidenceMethod:"證明方式",
        evidenceReference:"證明資料",
        privateEvidence:"私密學生證明",
        loadEvidence:"查看私密證明",
        evidenceLoading:"正在載入受保護嘅證明…",
        evidenceNone:"呢份申請無附加私密文件。",
        openEvidence:"安全開啟",
        evidenceOpenFailed:"未能開啟受保護文件。請確認審核權限後再試。",
        evidencePrivacyNote:"文件連結只會喺需要時建立，並於 60 秒後失效。文件已通過結構安全檢查，但並非病毒掃描。請使用受管理嘅裝置，亦唔好喺審核流程以外複製或保留證明。",
        applicantNote:"申請人說明",
        submittedAt:"提交時間",
        reviewedAt:"審核時間",
        reviewerNote:"審核說明",
        noValue:"未提供",
        academicEmail:"院校電郵",
        institutionSso:"院校 SSO",
        manualReview:"人手審核",
        decisionMethod:"驗證方式",
        notePlaceholder:"為申請人同審核記錄填寫清晰說明。",
        approve:"批准",
        reject:"拒絕",
        approveTitle:"批准校園身份",
        approveConfirm:"批准呢份申請並授予已驗證校園功能存取權？",
        rejectTitle:"拒絕校園身份",
        rejectConfirm:"拒絕呢份申請？申請人重新提交之前會見到你嘅審核說明。",
        rejectNoteRequired:"拒絕申請之前請填寫審核說明。",
        savingDecision:"正在儲存審核決定…",
        approved:"校園身份已批准。",
        rejected:"校園身份已拒絕。",
        decisionFailed:"未能儲存審核決定，請再試。",
        statusLabel:"狀態",
        statusAll:"全部狀態",
        statusOpen:"待處理",
        statusReviewing:"審核中",
        statusVerified:"已核驗",
        statusEvidenceAccepted:"證據已接納",
        statusCancelled:"已取消",
        statusProcessing:"處理中",
        statusCompleted:"已完成",
        statusResolved:"已解決",
        statusDismissed:"已駁回",
        statusAwaitingUser:"等候用戶",
        statusClosed:"已關閉",
        statusResolvedBuyer:"支持買家",
        statusResolvedSeller:"支持賣家",
        workflowSchool:"校園身份",
        workflowPayments:"付款證明",
        workflowDisputes:"交易爭議",
        workflowMarketReports:"市集舉報",
        workflowContentReports:"安全舉報",
        workflowDeletion:"帳戶及私隱",
        workflowSupport:"其他申請",
        workflowTeam:"管理員團隊",
        workflowSchoolDescription:"審核院校證明，再授予已驗證校園功能存取權。",
        workflowPaymentsDescription:"審核用戶提交嘅付款證明同支付狀態異常。支付平台狀態仍由伺服器控制。",
        workflowDisputesDescription:"審核受保護交易爭議並記錄處理結果。",
        workflowMarketReportsDescription:"審核商品同市集行為舉報。",
        workflowContentReportsDescription:"審核帖子、留言、私訊同用戶舉報。",
        workflowDeletionDescription:"以可審計方式處理帳戶刪除同私隱申請。",
        workflowSupportDescription:"處理存取、市集、學術同一般支援申請。",
        caseReference:"個案",
        requester:"申請人",
        created:"建立時間",
        updated:"更新時間",
        order:"訂單",
        listing:"商品",
        amount:"金額",
        paymentState:"支付平台狀態",
        provider:"支付平台",
        reason:"原因",
        details:"詳情",
        category:"類別",
        subject:"主題",
        priority:"優先次序",
        decisionNote:"審核說明",
        decisionNotePlaceholder:"為申請人同審計記錄清楚說明決定。",
        noteRequired:"完成呢個操作之前請填寫審核說明。",
        actionUnderReview:"開始審核",
        actionAcceptEvidence:"接受付款證明",
        actionRecommendRefund:"建議向買家退款",
        actionRecommendRelease:"建議向賣家放款",
        actionReturnToQueue:"退回待處理隊列",
        actionRequestInfo:"要求補充資料",
        actionApprove:"批准",
        actionReject:"拒絕",
        actionVerify:"核驗證明",
        actionResolve:"解決",
        actionResolveBuyer:"支持買家",
        actionResolveSeller:"支持賣家",
        actionClose:"關閉",
        actionDismiss:"駁回",
        actionProcessing:"標記處理中",
        actionComplete:"完成",
        actionCancel:"取消申請",
        actionEscalate:"升級處理",
        actionConfirmTitle:"確認審核操作",
        actionConfirm:"確定對呢個個案執行「{action}」？",
        actionSaved:"個案已更新。",
        teamKicker:"存取控制",
        teamTitle:"獲委任管理員",
        teamDescription:"委任可信管理員，並只授予佢所需嘅審核權限。",
        teamIdentifier:"已確認嘅帳戶電郵",
        teamRole:"角色",
        teamScopes:"允許嘅工作流程",
        teamAppoint:"委任管理員",
        teamSave:"儲存權限",
        teamRevoke:"撤銷權限",
        teamLoading:"正在載入管理員團隊…",
        teamEmptyTitle:"暫無獲委任管理員",
        teamEmptyDescription:"需要分派審核工作時，可以喺呢度委任管理員。",
        teamIdentifierRequired:"請輸入管理員已確認嘅帳戶電郵。",
        teamScopeRequired:"請至少選擇一個工作流程。",
        teamAppointed:"管理員已委任。",
        teamUpdated:"管理員權限已更新。",
        teamRevoked:"管理員權限已撤銷。",
        teamUnavailable:"管理員團隊暫時未能使用。",
        revokeConfirm:"撤銷呢位管理員嘅審核中心權限？",
        privacyRole:"私隱管理員"
      }
    });
  }

  function normalizeAdminCapabilities(payload={}, role=""){
    const normalized = new Set();
    const sources = [payload.capabilities, payload.scopes, payload.permissions];
    const aliases = {
      view_school_verification_queue:"school_verification.review",
      review_school_verification_requests:"school_verification.review",
      review_school_verification:"school_verification.review",
      review_payment_evidence:"payment_evidence.review",
      review_marketplace_disputes:"marketplace_disputes.review",
      review_marketplace_reports:"marketplace_reports.review",
      review_content_reports:"content_reports.review",
      review_account_deletion:"account_deletion.review",
      review_support_requests:"support_requests.review",
      manage_admin_team:"team.manage",
      view_owner_summary:"owner_summary.view"
    };
    const add = value => {
      const key = String(value || "").trim();
      if(key) normalized.add(aliases[key] || key);
    };
    sources.forEach(source => {
      if(Array.isArray(source)) source.forEach(add);
      else if(source && typeof source === "object"){
        Object.entries(source).forEach(([key, value]) => {
          if(value === true) add(key);
          else if(Array.isArray(value)) value.forEach(add);
        });
      }
    });
    if(role === "owner"){
      VERIFICATION_WORKFLOWS.forEach(workflow => normalized.add(workflow.scope));
      normalized.add("team.manage");
      normalized.add("owner_summary.view");
    } else if(role === "reviewer" && !normalized.size){
      normalized.add("school_verification.review");
    } else if(role === "privacy" && !normalized.size){
      normalized.add("account_deletion.review");
    }
    return normalized;
  }

  const hasAdminCapability = scope => hubState.adminRole === "owner" || hubState.adminCapabilities.has(scope);
  const canOpenVerificationCenter = () => (
    hasAdminCapability("team.manage")
    || VERIFICATION_WORKFLOWS.some(workflow => hasAdminCapability(workflow.scope))
  );
  // Compatibility alias retained for the original owner-console route and
  // school-review functions. New workflows use the scoped checks above.
  const canReviewSchoolVerifications = () => canOpenVerificationCenter();
  const canReviewSchoolCases = () => hasAdminCapability("school_verification.review");

  function adminRoleLabel(){
    const copy = ownerConsoleCopy();
    if(hubState.adminRole === "owner") return copy.ownerRole;
    if(hubState.adminRole === "privacy") return copy.privacyRole;
    return copy.reviewerRole;
  }

  function ensureAccountTrustControls(){
    const card = document.querySelector(".hub-profile-controls-card");
    const save = card?.querySelector(".hub-profile-save");
    if(!card || !save) return null;
    let shell = $("hubAccountTrustControls");
    if(shell) return shell;
    shell = node("div", "hub-account-trust-controls");
    shell.id = "hubAccountTrustControls";

    const verification = node("section", "hub-account-trust-section hub-school-verification");
    verification.id = "hubSchoolVerification";
    const verificationHeading = node("h3");
    verificationHeading.id = "hubSchoolVerificationHeading";
    const verificationDescription = node("p", "hub-account-trust-description");
    verificationDescription.id = "hubSchoolVerificationDescription";
    const verificationStatus = node("p", "hub-account-trust-status");
    verificationStatus.id = "hubSchoolVerificationStatus";
    verificationStatus.setAttribute("role", "status");
    verificationStatus.setAttribute("aria-live", "polite");
    const verificationRecovery = node("div", "hub-student-verification-recovery");
    verificationRecovery.id = "hubVerificationRecovery";
    const verificationRetry = node("button", "btn-ghost");
    verificationRetry.type = "button";
    verificationRetry.id = "hubRetrySchoolVerification";
    verificationRetry.addEventListener("click", () => void retrySchoolVerificationLoad());
    verificationRecovery.append(verificationRetry);
    const verificationProgress = node("ol", "hub-student-verification-progress");
    verificationProgress.id = "hubVerificationProgress";
    [
      ["profile", "verificationStepProfile"],
      ["evidence", "verificationStepEvidence"],
      ["review", "verificationStepReview"]
    ].forEach(([step, copyKey], index) => {
      const item = node("li");
      item.dataset.verificationStep = step;
      item.dataset.copyKey = copyKey;
      const number = node("span", "hub-student-verification-step-number", String(index + 1));
      number.setAttribute("aria-hidden", "true");
      item.append(
        number,
        node("b"),
        node("span", "hub-visually-hidden hub-student-verification-step-state")
      );
      verificationProgress.append(item);
    });

    const identitySummary = node("div", "hub-student-verification-identity");
    [
      ["hubVerificationSchoolLabel", "hubVerificationSchoolValue", ""],
      ["hubVerificationEmailLabel", "hubVerificationEmailValue", "hubVerificationEmailNote"],
      ["hubVerificationMembershipLabel", "hubVerificationMembershipValue", ""]
    ].forEach(([labelId, valueId, noteId]) => {
      const item = node("div");
      const label = node("span");
      label.id = labelId;
      const value = node("strong");
      value.id = valueId;
      item.append(label, value);
      if(noteId){
        const note = node("small", "hub-student-verification-identity-note");
        note.id = noteId;
        item.append(note);
      }
      identitySummary.append(item);
    });

    const verificationForm = node("form", "hub-account-trust-form hub-student-verification-form");
    verificationForm.id = "hubStudentVerificationForm";
    verificationForm.noValidate = true;
    const methodValue = node("input");
    methodValue.type = "hidden";
    methodValue.id = "hubVerificationMethod";
    methodValue.value = "academic_email";
    const methodFieldset = node("fieldset", "hub-student-verification-methods hub-account-trust-wide");
    const methodLegend = node("legend");
    methodLegend.id = "hubVerificationMethodLabel";
    methodFieldset.append(methodLegend);
    [
      ["academic_email", "academicEmail", "academicEmailHelp"],
      ["institution_sso", "institutionSso", "institutionSsoHelp"],
      ["student_document", "studentDocument", "studentDocumentHelp"]
    ].forEach(([value, titleKey, helpKey], index) => {
      const card = node("label", "hub-student-verification-method");
      card.dataset.method = value;
      const radio = node("input");
      radio.type = "radio";
      radio.name = "hubVerificationMethodChoice";
      radio.value = value;
      radio.checked = index === 0;
      radio.addEventListener("change", () => {
        if(!radio.checked) return;
        methodValue.value = radio.value;
        renderAccountTrustControls();
      });
      const copyBlock = node("span");
      const title = node("b");
      title.dataset.copyKey = titleKey;
      const help = node("small");
      help.dataset.copyKey = helpKey;
      copyBlock.append(title, help);
      card.append(radio, copyBlock);
      methodFieldset.append(card);
    });

    const academicPanel = node("section", "hub-student-verification-academic hub-account-trust-wide");
    academicPanel.id = "hubAcademicEmailPanel";
    const academicEmailLabel = node("label", "hub-student-verification-academic-email");
    const academicEmailText = node("span");
    academicEmailText.id = "hubAcademicEmailLabel";
    const academicEmail = node("input");
    academicEmail.id = "hubAcademicEmailInput";
    academicEmail.type = "email";
    academicEmail.autocomplete = "email";
    academicEmail.inputMode = "email";
    academicEmail.maxLength = 254;
    academicEmail.spellcheck = false;
    academicEmail.setAttribute("aria-describedby", "hubAcademicEmailPrivacy hubAcademicEmailStatus");
    academicEmail.addEventListener("input", () => academicEmail.removeAttribute("aria-invalid"));
    academicEmail.addEventListener("keydown", event => {
      if(event.key !== "Enter") return;
      event.preventDefault();
      void sendAcademicEmailVerificationCode();
    });
    academicEmailLabel.append(academicEmailText, academicEmail);
    const sendAcademicEmailCode = node("button", "btn-primary hub-student-verification-send-code");
    sendAcademicEmailCode.type = "button";
    sendAcademicEmailCode.id = "hubSendAcademicEmailCode";
    sendAcademicEmailCode.addEventListener("click", () => void sendAcademicEmailVerificationCode());
    const academicCodeField = node("div", "hub-student-verification-code");
    academicCodeField.id = "hubAcademicEmailCodeField";
    const academicCodeLabel = node("label");
    const academicCodeText = node("span");
    academicCodeText.id = "hubAcademicEmailCodeLabel";
    const academicCode = node("input");
    academicCode.id = "hubAcademicEmailCode";
    academicCode.type = "text";
    academicCode.inputMode = "numeric";
    academicCode.pattern = "[0-9]{8}";
    academicCode.maxLength = 8;
    academicCode.autocomplete = "one-time-code";
    academicCode.setAttribute("aria-describedby", "hubAcademicEmailStatus");
    academicCode.addEventListener("input", () => {
      academicCode.value = academicCode.value.replace(/\D/g, "").slice(0, 8);
      academicCode.removeAttribute("aria-invalid");
    });
    academicCode.addEventListener("keydown", event => {
      if(event.key !== "Enter") return;
      event.preventDefault();
      void confirmAcademicEmailVerificationCode();
    });
    academicCodeLabel.append(academicCodeText, academicCode);
    const verifyAcademicEmailCode = node("button", "btn-primary");
    verifyAcademicEmailCode.type = "button";
    verifyAcademicEmailCode.id = "hubVerifyAcademicEmailCode";
    verifyAcademicEmailCode.addEventListener("click", () => void confirmAcademicEmailVerificationCode());
    academicCodeField.append(academicCodeLabel, verifyAcademicEmailCode);
    const academicPrivacy = node("p", "hub-student-verification-privacy");
    academicPrivacy.id = "hubAcademicEmailPrivacy";
    const academicStatus = node("p", "hub-account-trust-status hub-academic-email-status");
    academicStatus.id = "hubAcademicEmailStatus";
    academicStatus.setAttribute("role", "status");
    academicStatus.setAttribute("aria-live", "polite");
    academicPanel.append(
      academicEmailLabel,
      sendAcademicEmailCode,
      academicCodeField,
      academicPrivacy,
      academicStatus
    );

    const referenceLabel = node("label", "hub-student-verification-reference hub-account-trust-wide");
    referenceLabel.id = "hubVerificationReferenceField";
    const referenceText = node("span");
    referenceText.id = "hubVerificationReferenceLabel";
    const reference = node("input");
    reference.id = "hubVerificationReference";
    reference.maxLength = 500;
    reference.setAttribute("aria-describedby", "hubVerificationSsoSafety hubSchoolVerificationStatus");
    reference.addEventListener("input", () => reference.removeAttribute("aria-invalid"));
    const ssoSafety = node("small", "hub-student-verification-safety");
    ssoSafety.id = "hubVerificationSsoSafety";
    referenceLabel.append(referenceText, reference, ssoSafety);

    const documentPanel = node("section", "hub-student-verification-documents hub-account-trust-wide");
    documentPanel.id = "hubVerificationDocumentPanel";
    const documentTypeLabel = node("label", "hub-student-verification-document-type");
    const documentTypeText = node("span");
    documentTypeText.id = "hubVerificationDocumentTypeLabel";
    const documentType = document.createElement("select");
    documentType.id = "hubVerificationDocumentType";
    SCHOOL_VERIFICATION_DOCUMENT_TYPES.forEach(({id, labelKey}) => {
      const option = node("option");
      option.value = id;
      option.dataset.copyKey = labelKey;
      documentType.append(option);
    });
    documentTypeLabel.append(documentTypeText, documentType);
    const fileInput = node("input");
    fileInput.type = "file";
    fileInput.id = "hubVerificationFiles";
    fileInput.multiple = true;
    fileInput.accept = ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf";
    fileInput.className = "hub-visually-hidden";
    fileInput.tabIndex = -1;
    fileInput.setAttribute("aria-describedby", "hubVerificationFilesHelp hubVerificationPrivacy hubSchoolVerificationStatus");
    fileInput.addEventListener("change", () => {
      fileInput.removeAttribute("aria-invalid");
      void prepareSchoolVerificationFiles(fileInput.files);
    });
    const filePicker = node("button", "btn-ghost hub-student-verification-file-picker");
    filePicker.type = "button";
    filePicker.id = "hubVerificationChooseFiles";
    filePicker.setAttribute("aria-describedby", "hubVerificationFilesHelp hubSchoolVerificationStatus");
    filePicker.addEventListener("click", () => {
      if(!fileInput.disabled) fileInput.click();
    });
    const fileHelp = node("small", "hub-student-verification-file-help");
    fileHelp.id = "hubVerificationFilesHelp";
    const selectedHeading = node("h4");
    selectedHeading.id = "hubVerificationSelectedHeading";
    const fileList = node("div", "hub-student-verification-file-list");
    fileList.id = "hubVerificationFileList";
    fileList.setAttribute("aria-live", "polite");
    const privacy = node("p", "hub-student-verification-privacy");
    privacy.id = "hubVerificationPrivacy";
    const acknowledgementLabel = node("label", "hub-student-verification-acknowledgement");
    const acknowledgement = node("input");
    acknowledgement.type = "checkbox";
    acknowledgement.id = "hubVerificationRedaction";
    acknowledgement.setAttribute("aria-describedby", "hubVerificationPrivacy hubSchoolVerificationStatus");
    acknowledgement.addEventListener("change", () => acknowledgement.removeAttribute("aria-invalid"));
    const acknowledgementText = node("span");
    acknowledgementText.id = "hubVerificationRedactionLabel";
    acknowledgementLabel.append(acknowledgement, acknowledgementText);
    documentPanel.append(
      documentTypeLabel,
      fileInput,
      filePicker,
      fileHelp,
      selectedHeading,
      fileList,
      privacy,
      acknowledgementLabel
    );

    const noteLabel = node("label", "hub-account-trust-wide");
    noteLabel.id = "hubVerificationNoteField";
    const noteText = node("span");
    noteText.id = "hubVerificationNoteLabel";
    const note = node("textarea");
    note.id = "hubVerificationNote";
    note.maxLength = 1000;
    noteLabel.append(noteText, note);
    const verificationActions = node("div", "hub-account-trust-actions hub-account-trust-wide");
    const submit = node("button", "btn-primary");
    submit.type = "submit";
    submit.id = "hubSubmitVerification";
    const withdraw = node("button", "btn-ghost");
    withdraw.type = "button";
    withdraw.id = "hubWithdrawVerification";
    withdraw.onclick = () => void withdrawSchoolVerification();
    verificationActions.append(submit, withdraw);
    verificationForm.append(
      methodValue,
      methodFieldset,
      academicPanel,
      referenceLabel,
      documentPanel,
      noteLabel,
      verificationActions
    );
    verificationForm.addEventListener("submit", event => {
      event.preventDefault();
      void submitSchoolVerification();
    });
    const history = node("section", "hub-student-verification-history");
    const historyHeading = node("h4");
    historyHeading.id = "hubVerificationHistoryHeading";
    const historyList = node("ol");
    historyList.id = "hubVerificationHistoryList";
    history.append(historyHeading, historyList);
    verification.append(
      verificationHeading,
      verificationDescription,
      verificationProgress,
      identitySummary,
      verificationStatus,
      verificationRecovery,
      verificationForm,
      history
    );

    const deletion = node("section", "hub-account-trust-section hub-account-deletion");
    deletion.id = "hubAccountDeletion";
    const deletionHeading = node("h3");
    deletionHeading.id = "hubAccountDeletionHeading";
    const deletionDescription = node("p", "hub-account-trust-description");
    deletionDescription.id = "hubAccountDeletionDescription";
    const deletionStatus = node("p", "hub-account-trust-status");
    deletionStatus.id = "hubAccountDeletionStatus";
    deletionStatus.setAttribute("role", "status");
    deletionStatus.setAttribute("aria-live", "polite");
    const deletionActions = node("div", "hub-account-trust-actions");
    const requestDeletion = node("button", "btn-ghost hub-account-delete-button");
    requestDeletion.type = "button";
    requestDeletion.id = "hubRequestAccountDeletion";
    requestDeletion.onclick = () => void requestAccountDeletion();
    const cancelDeletion = node("button", "btn-ghost");
    cancelDeletion.type = "button";
    cancelDeletion.id = "hubCancelAccountDeletion";
    cancelDeletion.onclick = () => void cancelAccountDeletion();
    deletionActions.append(requestDeletion, cancelDeletion);
    deletion.append(deletionHeading, deletionDescription, deletionStatus, deletionActions);

    const support = node("section", "hub-account-trust-section hub-support-request hub-account-trust-wide");
    support.id = "hubSupportRequest";
    const supportHeading = node("h3");
    supportHeading.id = "hubSupportRequestHeading";
    const supportDescription = node("p", "hub-account-trust-description");
    supportDescription.id = "hubSupportRequestDescription";
    const supportStatus = node("p", "hub-account-trust-status");
    supportStatus.id = "hubSupportRequestStatus";
    supportStatus.setAttribute("role", "status");
    supportStatus.setAttribute("aria-live", "polite");
    const supportForm = node("form", "hub-account-trust-form hub-support-request-form");
    supportForm.id = "hubSupportRequestForm";
    const categoryLabel = node("label");
    const categoryText = node("span");
    categoryText.id = "hubSupportCategoryLabel";
    const category = document.createElement("select");
    category.id = "hubSupportCategory";
    [
      ["account", "supportAccount"],
      ["school", "supportSchool"],
      ["marketplace", "supportMarketplace"],
      ["payment", "supportPayment"],
      ["community", "supportCommunity"],
      ["privacy", "supportPrivacy"],
      ["safety", "supportSafety"],
      ["technical", "supportTechnical"],
      ["other", "supportOther"]
    ].forEach(([value, key]) => {
      const option = document.createElement("option");
      option.value = value;
      option.dataset.copyKey = key;
      category.append(option);
    });
    categoryLabel.append(categoryText, category);
    const subjectLabel = node("label");
    const subjectText = node("span");
    subjectText.id = "hubSupportSubjectLabel";
    const subject = node("input");
    subject.id = "hubSupportSubject";
    subject.maxLength = 160;
    subject.required = true;
    subjectLabel.append(subjectText, subject);
    const detailsLabel = node("label", "hub-account-trust-wide");
    const detailsText = node("span");
    detailsText.id = "hubSupportDetailsLabel";
    const supportDetails = node("textarea");
    supportDetails.id = "hubSupportDetails";
    supportDetails.maxLength = 3000;
    supportDetails.required = true;
    detailsLabel.append(detailsText, supportDetails);
    const supportActions = node("div", "hub-account-trust-actions hub-account-trust-wide");
    const submitSupport = node("button", "btn-primary");
    submitSupport.type = "submit";
    submitSupport.id = "hubSubmitSupportRequest";
    supportActions.append(submitSupport);
    supportForm.append(categoryLabel, subjectLabel, detailsLabel, supportActions);
    supportForm.addEventListener("submit", event => {
      event.preventDefault();
      void submitSupportRequest();
    });
    const supportHistoryHeading = node("h4", "hub-support-history-heading");
    supportHistoryHeading.id = "hubSupportRequestHistoryHeading";
    const supportHistory = node("div", "hub-support-request-list");
    supportHistory.id = "hubSupportRequestList";
    supportHistory.setAttribute("role", "list");
    support.append(supportHeading, supportDescription, supportStatus, supportForm, supportHistoryHeading, supportHistory);

    shell.append(verification, deletion, support);
    card.insertBefore(shell, save);
    renderAccountTrustControls();
    return shell;
  }

  function schoolVerificationMethodLabel(method, copy=accountTrustCopy()){
    const key = {
      academic_email:"academicEmail",
      institution_sso:"institutionSso",
      student_document:"studentDocument",
      manual_review:"studentDocument"
    }[String(method || "")] || "studentDocument";
    return copy[key];
  }

  function schoolVerificationStatusLabel(status, copy=accountTrustCopy()){
    const key = {
      submitted:"statusSubmitted",
      under_review:"statusUnderReview",
      approved:"statusApproved",
      rejected:"statusRejected",
      withdrawn:"statusWithdrawn"
    }[String(status || "")] || "statusNotSubmitted";
    return copy[key];
  }

  function schoolVerificationFileSize(size){
    const bytes = Number(size || 0);
    if(!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
    if(bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  function schoolVerificationDocumentLabel(type, copy=accountTrustCopy()){
    const document = SCHOOL_VERIFICATION_DOCUMENT_TYPES.find(candidate => candidate.id === type);
    return copy[document?.labelKey || "documentOther"];
  }

  async function schoolVerificationFileDescriptor(file){
    const copy = accountTrustCopy();
    if(!(file instanceof Blob) || !file.size) throw new Error(copy.evidenceFileInvalid);
    if(file.size > SCHOOL_VERIFICATION_MAX_FILE_BYTES) throw new Error(copy.evidenceFileTooLarge);
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const isPdf = bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    const isWebp = bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    const detected = isPdf
      ? {mimeType:"application/pdf", extension:"pdf"}
      : (isJpeg
        ? {mimeType:"image/jpeg", extension:"jpg"}
        : (isPng
          ? {mimeType:"image/png", extension:"png"}
          : (isWebp ? {mimeType:"image/webp", extension:"webp"} : null)));
    if(!detected) throw new Error(copy.evidenceFileInvalid);
    const declared = String(file.type || "").toLocaleLowerCase();
    if(declared && declared !== detected.mimeType && !(declared === "image/jpg" && detected.mimeType === "image/jpeg")){
      throw new Error(copy.evidenceFileInvalid);
    }
    const safeName = String(file.name || `evidence.${detected.extension}`)
      .replace(/[\/\\\u0000-\u001f\u007f]/g, "-")
      .trim()
      .slice(0, 180) || `evidence.${detected.extension}`;
    return {
      id:crypto.randomUUID(),
      file,
      name:safeName,
      mimeType:detected.mimeType,
      extension:detected.extension,
      sizeBytes:file.size,
      documentType:$("hubVerificationDocumentType")?.value || "student_id"
    };
  }

  async function prepareSchoolVerificationFiles(files){
    const copy = accountTrustCopy();
    const candidates = [...(files || [])];
    if(!candidates.length || hubState.schoolVerificationFilePreparing) return;
    const available = SCHOOL_VERIFICATION_MAX_FILES - hubState.schoolVerificationFiles.length;
    if(available <= 0){
      $("hubSchoolVerificationStatus").textContent = copy.evidenceFileLimit;
      $("hubSchoolVerificationStatus").className = "hub-account-trust-status error";
      if($("hubVerificationFiles")) $("hubVerificationFiles").value = "";
      return;
    }
    const context = requestContext();
    hubState.schoolVerificationFilePreparing = true;
    $("hubSchoolVerificationStatus").textContent = copy.evidencePreparing;
    $("hubSchoolVerificationStatus").className = "hub-account-trust-status";
    renderAccountTrustControls();
    let lastError = "";
    const prepared = [];
    try {
      for(const file of candidates.slice(0, available)){
        try {
          prepared.push(await schoolVerificationFileDescriptor(file));
        } catch(error){
          lastError = error?.message || copy.evidenceFileInvalid;
        }
      }
      if(!contextIsCurrent(context)) return;
      if(candidates.length > available) lastError = copy.evidenceFileLimit;
      hubState.schoolVerificationFiles.push(...prepared);
    } finally {
      if(contextIsCurrent(context)){
        hubState.schoolVerificationFilePreparing = false;
        if($("hubVerificationFiles")) $("hubVerificationFiles").value = "";
        renderAccountTrustControls();
        $("hubSchoolVerificationStatus").textContent = lastError || copy.evidenceReady;
        $("hubSchoolVerificationStatus").className = `hub-account-trust-status ${lastError ? "error" : "success"}`;
      }
    }
  }

  function renderSchoolVerificationFiles({disabled=false}={}){
    const list = $("hubVerificationFileList");
    if(!list) return;
    const copy = accountTrustCopy();
    list.replaceChildren();
    if(!hubState.schoolVerificationFiles.length){
      list.append(node("p", "hub-student-verification-file-empty", copy.noEvidenceSelected));
      return;
    }
    hubState.schoolVerificationFiles.forEach((item, index) => {
      const row = node("article", "hub-student-verification-file");
      const details = node("div");
      details.append(
        node("b", "", item.name),
        node("small", "", `${item.mimeType.replace("application/", "").replace("image/", "").toLocaleUpperCase()} · ${schoolVerificationFileSize(item.sizeBytes)}`)
      );
      const type = document.createElement("select");
      type.setAttribute("aria-label", `${copy.documentType}: ${item.name}`);
      SCHOOL_VERIFICATION_DOCUMENT_TYPES.forEach(({id, labelKey}) => {
        const option = node("option", "", copy[labelKey]);
        option.value = id;
        type.append(option);
      });
      type.value = item.documentType;
      type.disabled = disabled;
      type.addEventListener("change", () => { item.documentType = type.value; });
      const remove = node("button", "btn-ghost hub-student-verification-file-remove", copy.removeEvidence);
      remove.type = "button";
      remove.disabled = disabled;
      remove.setAttribute("aria-label", `${copy.removeEvidence}: ${item.name}`);
      remove.onclick = () => {
        hubState.schoolVerificationFiles = hubState.schoolVerificationFiles.filter(candidate => candidate.id !== item.id);
        renderAccountTrustControls();
        requestAnimationFrame(() => {
          const remaining = [...document.querySelectorAll(".hub-student-verification-file-remove")];
          (remaining[Math.min(index, Math.max(0, remaining.length - 1))] || $("hubVerificationChooseFiles"))?.focus();
        });
      };
      row.append(details, type, remove);
      list.append(row);
    });
  }

  function renderSchoolVerificationHistory(payload, copy=accountTrustCopy()){
    const list = $("hubVerificationHistoryList");
    if(!list) return;
    list.replaceChildren();
    let history = Array.isArray(payload?.history) ? payload.history : [];
    if(!history.length && payload?.latest_request) history = [payload.latest_request];
    if(!history.length){
      const empty = node("li", "hub-student-verification-history-empty", copy.verificationHistoryEmpty);
      list.append(empty);
      return;
    }
    history.forEach(request => {
      const status = String(request?.status || "");
      const item = node("li", "hub-student-verification-history-item");
      const heading = node("div");
      heading.append(
        node("b", "", schoolVerificationMethodLabel(request?.submission_method || request?.evidence_kind, copy)),
        node("span", `hub-student-verification-status-badge ${status.replace(/[^a-z_]/g, "")}`, schoolVerificationStatusLabel(status, copy))
      );
      const metadata = [
        request?.submitted_at ? `${copy.submittedOn}: ${formatDate(request.submitted_at)}` : "",
        request?.reviewed_at ? `${copy.reviewedOn}: ${formatDate(request.reviewed_at)}` : ""
      ].filter(Boolean);
      item.append(heading);
      if(metadata.length) item.append(node("small", "", metadata.join(" · ")));
      if(Number(request?.evidence_count) > 0){
        item.append(node("small", "", `${copy.selectedEvidence}: ${Number(request.evidence_count).toLocaleString(locale())}`));
      }
      if(request?.reviewer_note){
        const feedback = node("blockquote");
        feedback.append(node("b", "", copy.reviewerFeedback), node("span", "", request.reviewer_note));
        item.append(feedback);
      }
      list.append(item);
    });
  }

  function renderAccountTrustControls(){
    const shell = ensureAccountTrustControls();
    if(!shell) return;
    const copy = accountTrustCopy();
    $("hubSchoolVerificationHeading").textContent = copy.verificationTitle;
    $("hubSchoolVerificationDescription").textContent = copy.verificationDescription;
    $("hubVerificationMethodLabel").textContent = copy.verificationMethod;
    $("hubAcademicEmailLabel").textContent = copy.academicEmailAddress;
    $("hubAcademicEmailInput").placeholder = copy.academicEmailPlaceholder;
    $("hubAcademicEmailCodeLabel").textContent = copy.academicEmailCode;
    $("hubAcademicEmailCode").placeholder = copy.academicEmailCodePlaceholder;
    $("hubVerifyAcademicEmailCode").textContent = copy.verifyAcademicEmailCode;
    $("hubAcademicEmailPrivacy").textContent = copy.academicEmailPrivacy;
    $("hubRetrySchoolVerification").textContent = copy.verificationRetry;
    $("hubVerificationReferenceLabel").textContent = copy.evidenceReference;
    $("hubVerificationNoteLabel").textContent = copy.verificationNote;
    document.querySelectorAll(".hub-student-verification-method [data-copy-key]").forEach(element => {
      element.textContent = copy[element.dataset.copyKey];
    });
    $("hubVerificationSsoSafety").textContent = copy.ssoSafety;
    $("hubVerificationDocumentTypeLabel").textContent = copy.documentType;
    $("hubVerificationDocumentType").querySelectorAll("option").forEach(option => {
      option.textContent = copy[option.dataset.copyKey];
    });
    $("hubVerificationChooseFiles").textContent = copy.chooseEvidenceFiles;
    $("hubVerificationFilesHelp").textContent = copy.evidenceFilesHelp;
    $("hubVerificationSelectedHeading").textContent = copy.selectedEvidence;
    $("hubVerificationPrivacy").textContent = copy.evidencePrivacy;
    $("hubVerificationRedactionLabel").textContent = copy.redactionConfirmation;
    $("hubVerificationHistoryHeading").textContent = copy.verificationHistory;
    document.querySelectorAll("#hubVerificationProgress [data-copy-key]").forEach(item => {
      item.querySelector("b").textContent = copy[item.dataset.copyKey];
    });
    $("hubVerificationProgress").setAttribute("aria-label", copy.verificationProgressLabel);
    $("hubSubmitVerification").textContent = copy.submitVerification;
    $("hubWithdrawVerification").textContent = copy.withdrawVerification;
    $("hubAccountDeletionHeading").textContent = copy.accountTitle;
    $("hubAccountDeletionDescription").textContent = copy.accountDescription;
    $("hubRequestAccountDeletion").textContent = copy.requestDeletion;
    $("hubCancelAccountDeletion").textContent = copy.cancelDeletion;
    $("hubSupportRequestHeading").textContent = copy.supportTitle;
    $("hubSupportRequestDescription").textContent = copy.supportDescription;
    $("hubSupportCategoryLabel").textContent = copy.supportCategory;
    $("hubSupportSubjectLabel").textContent = copy.supportSubject;
    $("hubSupportDetailsLabel").textContent = copy.supportDetails;
    $("hubSupportRequestHistoryHeading").textContent = copy.supportCurrent;
    $("hubSubmitSupportRequest").textContent = copy.supportSubmit;
    $("hubSupportCategory").querySelectorAll("option").forEach(option => {
      option.textContent = copy[option.dataset.copyKey];
    });

    const verificationState = hubState.schoolVerificationRequest;
    const verificationPayload = verificationState?.data || {};
    const academicState = hubState.academicEmailVerificationState || {};
    const latestRequest = verificationPayload.latest_request || null;
    const membership = verificationPayload.membership || hubState.membership;
    const requestStatus = latestRequest?.status || "";
    const membershipApproved = membership?.status === "verified";
    const isVerified = Boolean(
      membership?.status === "verified"
      && membership?.verification_method === "academic_email"
      && membership?.verified_at
    );
    const requiresAcademicEmailUpgrade = membershipApproved && !isVerified;
    const isReviewing = ["submitted", "under_review"].includes(requestStatus);
    const isApprovalSyncPending = requestStatus === "approved" && !isVerified;
    const academicBusy = hubState.academicEmailVerificationLoading
      || hubState.academicEmailVerificationSending
      || hubState.academicEmailVerificationConfirming;
    const busy = hubState.schoolVerificationLoading
      || hubState.schoolVerificationFilePreparing
      || academicBusy;
    const latestMethod = String(
      latestRequest?.submission_method
      || (latestRequest?.evidence_kind === "manual_review" ? "student_document" : latestRequest?.evidence_kind)
      || ""
    );
    const approvedNonAcademicEvidence = requestStatus === "approved"
      && latestMethod
      && latestMethod !== "academic_email";
    if(isVerified || requiresAcademicEmailUpgrade || approvedNonAcademicEvidence){
      $("hubVerificationMethod").value = "academic_email";
    } else if(
      (isReviewing || isVerified || requestStatus === "approved")
      && ["academic_email", "institution_sso", "student_document"].includes(latestMethod)
    ){
      $("hubVerificationMethod").value = latestMethod;
      $("hubVerificationReference").value = latestRequest?.evidence_reference || "";
      $("hubVerificationNote").value = latestRequest?.user_note || "";
    }
    const method = $("hubVerificationMethod").value;
    const documentUnsupported = method === "student_document" && !hubState.schoolVerificationEnhanced;

    $("hubVerificationSchoolLabel").textContent = isVerified ? copy.verifiedSchool : copy.claimedSchool;
    $("hubVerificationSchoolValue").textContent = membership?.school_name || hubState.profile?.school_name || copy.noValue;
    $("hubVerificationEmailLabel").textContent = copy.accountEmail;
    $("hubVerificationEmailValue").textContent = currentUser?.email || copy.noValue;
    $("hubVerificationEmailNote").textContent = copy.accountEmailHelp;
    $("hubVerificationMembershipLabel").textContent = copy.membershipState;
    $("hubVerificationMembershipValue").textContent = isVerified
      ? copy.verifiedFor.replace("{school}", membership?.school_name || copy.noValue)
      : (requiresAcademicEmailUpgrade
        ? copy.academicEmailUpgradeRequired
        : schoolVerificationStatusLabel(requestStatus, copy));

    const schoolProfileComplete = Boolean(
      membership?.school_name
      && membership?.school_key
    );
    const progressState = isVerified
      ? "complete"
      : (schoolProfileComplete ? "evidence" : "profile");
    document.querySelectorAll("#hubVerificationProgress [data-verification-step]").forEach(item => {
      const step = item.dataset.verificationStep;
      const completed = (step === "profile" && schoolProfileComplete)
        || (step === "evidence" && ["review", "complete"].includes(progressState))
        || progressState === "complete";
      const current = (progressState === "profile" && step === "profile")
        || (progressState === "evidence" && step === "evidence")
        || (progressState === "review" && step === "review");
      const state = current ? "current" : (completed ? "complete" : "upcoming");
      item.classList.toggle("complete", completed);
      item.classList.toggle("current", current);
      item.dataset.state = state;
      item.querySelector(".hub-student-verification-step-state").textContent = {
        complete: copy.verificationStepComplete,
        current: copy.verificationStepCurrent,
        upcoming: copy.verificationStepUpcoming
      }[state];
      if(current) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });

    let verificationMessage = copy.verificationReady;
    if(busy) verificationMessage = hubState.schoolVerificationFilePreparing ? copy.evidencePreparing : copy.verificationLoading;
    else if(verificationState?.setupMissing) verificationMessage = copy.verificationUnavailable;
    else if(verificationState?.error) verificationMessage = verificationState.error;
    else if(isVerified) verificationMessage = copy.verificationApproved;
    else if(requiresAcademicEmailUpgrade) verificationMessage = copy.academicEmailUpgradeRequired;
    else if(approvedNonAcademicEvidence) verificationMessage = copy.academicEmailUpgradeRequired;
    else if(isApprovalSyncPending) verificationMessage = copy.verificationApprovalSyncPending;
    else if(requestStatus === "submitted") verificationMessage = copy.verificationAwaiting;
    else if(requestStatus === "under_review") verificationMessage = copy.verificationUnderReview;
    else if(requestStatus === "rejected") verificationMessage = copy.verificationRejected;
    else if(requestStatus === "withdrawn") verificationMessage = copy.verificationWithdrawn;
    else if(documentUnsupported) verificationMessage = copy.verificationEvidenceUnavailable;
    else if(!schoolProfileComplete) verificationMessage = copy.schoolProfileIncomplete;
    $("hubSchoolVerificationStatus").textContent = verificationMessage;
    $("hubSchoolVerificationStatus").className = `hub-account-trust-status${
      verificationState?.error || verificationState?.setupMissing || documentUnsupported
        ? " error"
        : (isVerified ? " success" : (
          requiresAcademicEmailUpgrade || isReviewing || isApprovalSyncPending ? " warning" : ""
        ))
    }`;
    $("hubVerificationRecovery").hidden = !(
      verificationState?.error
      || verificationState?.setupMissing
      || academicState.error
      || academicState.setupMissing
    );
    $("hubRetrySchoolVerification").disabled = busy;

    const locked = busy || isVerified;
    const nonAcademicLocked = locked
      || isReviewing
      || isApprovalSyncPending
      || verificationState?.setupMissing;
    document.querySelectorAll('input[name="hubVerificationMethodChoice"]').forEach(radio => {
      radio.checked = radio.value === method;
      radio.disabled = locked;
      radio.closest(".hub-student-verification-method")?.classList.toggle("selected", radio.checked);
    });
    const academicPayload = academicState.data || {};
    const academicChallengeId = String(academicPayload.challenge_id || "");
    const academicDelivered = academicPayload.delivery_status === "sent"
      || academicPayload.status === "sent";
    const academicDeliveryPending = ["pending", "sending"].includes(String(academicPayload.delivery_status || ""))
      || ["pending", "sending"].includes(String(academicPayload.status || ""));
    const academicDeliveryFailed = ["failed", "delivery_failed"].includes(String(academicPayload.delivery_status || ""))
      || ["failed", "delivery_failed"].includes(String(academicPayload.status || ""));
    const academicExpiry = new Date(academicPayload.expires_at || 0).getTime();
    const academicExpired = academicPayload.challenge_status === "expired"
      || (
        Number.isFinite(academicExpiry)
        && academicExpiry > 0
        && academicExpiry <= Date.now()
      );
    const academicLocked = academicPayload.challenge_status === "locked"
      || Number(academicPayload.attempts_remaining) <= 0;
    const academicSuperseded = academicPayload.challenge_status === "superseded";
    const academicVerified = academicPayload.status === "verified" || isVerified;
    const academicAwaitingCompletion = academicPayload.status === "submitted_for_review";
    const academicConfirmed = Boolean(academicVerified
      || academicAwaitingCompletion
      || academicPayload.confirmed_at
      || academicPayload.request_id
      || academicPayload.challenge_status === "confirmed");
    const academicChallengeActive = Boolean(
      academicChallengeId
      && academicDelivered
      && !academicConfirmed
      && !academicExpired
      && !academicLocked
      && !academicSuperseded
    );
    const resendAt = new Date(academicPayload.resend_available_at || 0).getTime();
    const resendWaiting = Number.isFinite(resendAt) && resendAt > Date.now();
    let academicMessage = "";
    if(hubState.academicEmailVerificationLoading) academicMessage = copy.academicEmailStateLoading;
    else if(academicState.setupMissing) academicMessage = copy.academicEmailSetupRequired;
    else if(academicState.error) academicMessage = academicState.error;
    else if(academicVerified) academicMessage = copy.academicEmailConfirmedForReview;
    else if(academicConfirmed) academicMessage = copy.academicEmailAwaitingCompletion;
    else if(academicDeliveryFailed) academicMessage = copy.academicEmailDeliveryFailed;
    else if(academicSuperseded) academicMessage = copy.academicEmailSuperseded;
    else if(academicExpired) academicMessage = copy.academicEmailExpired;
    else if(academicLocked) academicMessage = copy.academicEmailLocked;
    else if(academicChallengeActive && academicPayload.masked_email){
      academicMessage = (
        academicPayload.justSent
          ? copy.academicEmailCodeSent
          : copy.academicEmailCodeRestored
      ).replace("{email}", academicPayload.masked_email);
    } else if(academicDeliveryPending) academicMessage = copy.academicEmailSending;
    else academicMessage = copy.academicEmailCodeWaiting;
    $("hubAcademicEmailStatus").textContent = academicMessage;
    $("hubAcademicEmailStatus").className = `hub-account-trust-status hub-academic-email-status${
      academicState.error || academicState.setupMissing || academicDeliveryFailed
        ? " error"
        : (academicVerified
          ? " success"
          : ((academicConfirmed
            || academicChallengeActive
            || academicDeliveryPending
            || academicSuperseded
            || academicExpired
            || academicLocked) ? " warning" : ""))
    }`;
    $("hubAcademicEmailPanel").hidden = method !== "academic_email";
    $("hubSendAcademicEmailCode").textContent = academicChallengeId
      ? copy.resendAcademicEmailCode
      : copy.sendAcademicEmailCode;
    $("hubAcademicEmailInput").disabled = locked || academicState.setupMissing;
    $("hubSendAcademicEmailCode").disabled = locked || academicState.setupMissing || resendWaiting;
    $("hubAcademicEmailCode").disabled = locked || !academicChallengeActive;
    $("hubVerifyAcademicEmailCode").disabled = locked || !academicChallengeActive;
    $("hubVerificationReferenceField").hidden = method !== "institution_sso";
    $("hubVerificationDocumentPanel").hidden = method !== "student_document";
    $("hubVerificationNoteField").hidden = method === "academic_email";
    $("hubVerificationReference").disabled = nonAcademicLocked || method !== "institution_sso";
    $("hubVerificationNote").disabled = nonAcademicLocked;
    $("hubVerificationDocumentType").disabled = nonAcademicLocked || method !== "student_document";
    $("hubVerificationFiles").disabled = nonAcademicLocked || method !== "student_document" || !hubState.schoolVerificationEnhanced;
    $("hubVerificationChooseFiles").disabled = $("hubVerificationFiles").disabled;
    $("hubVerificationChooseFiles").classList.toggle("disabled", $("hubVerificationFiles").disabled);
    $("hubVerificationRedaction").disabled = nonAcademicLocked || method !== "student_document";
    renderSchoolVerificationFiles({disabled:nonAcademicLocked});
    renderSchoolVerificationHistory(verificationPayload, copy);
    $("hubSubmitVerification").hidden = method === "academic_email" || isVerified || isReviewing || isApprovalSyncPending;
    $("hubSubmitVerification").disabled = busy || verificationState?.setupMissing || documentUnsupported;
    $("hubWithdrawVerification").hidden = !isReviewing;
    $("hubWithdrawVerification").disabled = busy;
    $("hubStudentVerificationForm").setAttribute("aria-busy", busy ? "true" : "false");

    const deletionState = hubState.accountDeletionRequest;
    const deletionPayload = deletionState?.data || null;
    const deletionStatus = deletionPayload?.status || "";
    let deletionMessage = copy.deletionReady;
    if(hubState.accountDeletionLoading) deletionMessage = t("loading");
    else if(deletionState?.setupMissing) deletionMessage = copy.deletionUnavailable;
    else if(deletionState?.error) deletionMessage = deletionState.error;
    else if(deletionStatus === "submitted"){
      deletionMessage = copy.deletionScheduled.replace("{date}", formatDate(deletionPayload.scheduled_for));
    } else if(deletionStatus === "processing") deletionMessage = copy.deletionProcessing;
    else if(deletionStatus === "cancelled") deletionMessage = copy.deletionCancelled;
    else if(deletionStatus === "completed") deletionMessage = copy.deletionCompleted;
    $("hubAccountDeletionStatus").textContent = deletionMessage;
    $("hubAccountDeletionStatus").className = `hub-account-trust-status${deletionState?.error || deletionState?.setupMissing ? " error" : deletionStatus === "submitted" ? " warning" : ""}`;
    $("hubRequestAccountDeletion").hidden = ["submitted", "processing", "completed"].includes(deletionStatus);
    $("hubRequestAccountDeletion").disabled = hubState.accountDeletionLoading || deletionState?.setupMissing;
    $("hubCancelAccountDeletion").hidden = deletionStatus !== "submitted";
    $("hubCancelAccountDeletion").disabled = hubState.accountDeletionLoading;

    const supportBusy = hubState.supportRequestsLoading || hubState.supportRequestSubmitting;
    ["hubSupportCategory", "hubSupportSubject", "hubSupportDetails", "hubSubmitSupportRequest"].forEach(id => {
      $(id).disabled = supportBusy;
    });
    if(hubState.supportRequestsLoading){
      $("hubSupportRequestStatus").textContent = copy.supportLoading;
      $("hubSupportRequestStatus").className = "hub-account-trust-status";
    } else if(!$("hubSupportRequestStatus").textContent){
      $("hubSupportRequestStatus").textContent = "";
    }
    const supportList = $("hubSupportRequestList");
    supportList.replaceChildren();
    if(!hubState.supportRequestsLoading && !hubState.supportRequests.length){
      supportList.append(node("p", "hub-support-request-empty", copy.supportNone));
    } else {
      hubState.supportRequests.forEach(request => {
        const item = node("article", "hub-support-request-item");
        item.setAttribute("role", "listitem");
        const heading = node("div", "hub-support-request-item-heading");
        heading.append(
          node("b", "", request.subject || copy.supportOther),
          node("span", `hub-admin-request-status ${String(request.status || "submitted").replace(/[^a-z_]/g, "")}`, adminStatusLabel(request.status, ownerConsoleCopy()))
        );
        const categoryKey = {
          account:"supportAccount",
          school:"supportSchool",
          marketplace:"supportMarketplace",
          payment:"supportPayment",
          community:"supportCommunity",
          privacy:"supportPrivacy",
          safety:"supportSafety",
          technical:"supportTechnical",
          other:"supportOther"
        }[request.request_type || request.category] || "supportOther";
        item.append(
          heading,
          node("p", "", request.details || ""),
          node("small", "", [copy[categoryKey], formatDate(request.created_at || request.submitted_at)].filter(Boolean).join(" · "))
        );
        supportList.append(item);
      });
    }
  }

  function schoolVerificationUserError(error, copy=accountTrustCopy()){
    const message = errorText(error);
    const code = String(error?.code || "").toLocaleLowerCase();
    if(
      /authentication required|not authenticated|jwt|token.*expired|invalid token|unauthorized/i.test(message)
      || code === "401"
    ) return copy.verificationSessionExpired;
    if(
      /complete your school profile|check your school profile|approved academic email|approved academic domain|mapped to one supported institution|claimed institution/i.test(message)
    ) return copy.academicEmailSchoolRequired;
    return featureError(error);
  }

  function academicEmailUserError(error, copy=accountTrustCopy()){
    const code = String(error?.code || "").toLocaleLowerCase();
    const message = errorText(error);
    if(code === "invalid_academic_email") return copy.academicEmailInvalid;
    if(code === "invalid_code") return copy.academicEmailInvalidCode;
    if(code === "code_expired") return copy.academicEmailExpired;
    if(code === "code_locked") return copy.academicEmailLocked;
    if(code === "email_delivery_failed" || code === "delivery_state_failed") return copy.academicEmailDeliveryFailed;
    if(code === "verification_not_configured") return copy.academicEmailSetupRequired;
    if(code === "verification_service_unreachable" || code === "origin_not_allowed") return copy.academicEmailConnectionFailed;
    if(code === "account_email_unconfirmed") return copy.academicEmailAccountUnconfirmed;
    if(code === "already_verified"){
      return isAcademicEmailVerifiedStudent()
        ? copy.academicEmailAlreadyVerified
        : copy.academicEmailUpgradeRequired;
    }
    if(code === "academic_email_not_allowed" || code === "school_profile_required") return copy.academicEmailSchoolRequired;
    if(code === "academic_email_in_use") return copy.academicEmailInUse;
    if(code === "review_already_active") return copy.academicEmailReviewActive;
    if(code === "rate_limited" || code === "review_limit_reached") return copy.academicEmailResendWait;
    if(
      /authentication required|not authenticated|jwt|token.*expired|invalid token|unauthorized/i.test(message)
      || code === "401"
    ) return copy.verificationSessionExpired;
    if(
      /school profile|academic email domain|approved academic email|supported institution/i.test(message)
    ) return copy.academicEmailSchoolRequired;
    return featureError(error);
  }

  function scheduleAcademicEmailCooldown(){
    if(hubState.academicEmailCooldownTimer) window.clearTimeout(hubState.academicEmailCooldownTimer);
    hubState.academicEmailCooldownTimer = 0;
    const resendAt = new Date(
      hubState.academicEmailVerificationState?.data?.resend_available_at || 0
    ).getTime();
    if(!Number.isFinite(resendAt) || resendAt <= Date.now()) return;
    hubState.academicEmailCooldownTimer = window.setTimeout(() => {
      hubState.academicEmailCooldownTimer = 0;
      renderAccountTrustControls();
    }, Math.min(Math.max(resendAt - Date.now() + 50, 50), 2147483647));
  }

  async function academicEmailFunction(action, body){
    let response;
    try {
      response = await authClient.functions.invoke("academic-email-verification", {
        body:{action, ...body}
      });
    } catch(error){
      const connectionError = new Error("Academic email verification service is unreachable");
      connectionError.code = "verification_service_unreachable";
      connectionError.cause = error;
      return {data:null, error:connectionError};
    }
    if(!response.error) return {data:parseJsonValue(response.data, response.data) || {}, error:null};
    let payload = parseJsonValue(response.data, response.data) || {};
    try {
      const context = response.error?.context;
      if(context && typeof context.clone === "function"){
        const parsed = await context.clone().json();
        if(parsed && typeof parsed === "object") payload = parsed;
      }
    } catch(_error){}
    const error = new Error(String(payload.message || response.error.message || "Academic email verification failed"));
    error.code = String(payload.error || response.error.code || "");
    error.status = response.error?.context?.status || 0;
    return {data:null, error};
  }

  async function loadAcademicEmailVerificationState(){
    ensureAccountTrustControls();
    if(!authClient || !currentUser) return null;
    const context = requestContext();
    hubState.academicEmailVerificationLoading = true;
    renderAccountTrustControls();
    let response;
    try { response = await hubRpc("get_my_academic_email_verification_state"); }
    catch(error){ response = {data:null, error}; }
    if(!contextIsCurrent(context)) return null;
    hubState.academicEmailVerificationLoading = false;
    if(response.error){
      const setupMissing = missingRpcError(response.error);
      hubState.academicEmailVerificationState = {
        data:null,
        setupMissing,
        error:setupMissing ? "" : academicEmailUserError(response.error)
      };
    } else {
      hubState.academicEmailVerificationState = {
        data:parseJsonValue(response.data, response.data) || {},
        setupMissing:false,
        error:""
      };
    }
    scheduleAcademicEmailCooldown();
    renderAccountTrustControls();
    return hubState.academicEmailVerificationState;
  }

  async function sendAcademicEmailVerificationCode(){
    if(!authClient || !currentUser || hubState.academicEmailVerificationSending) return;
    const copy = accountTrustCopy();
    const input = $("hubAcademicEmailInput");
    const academicEmail = input.value.trim().toLocaleLowerCase();
    input.removeAttribute("aria-invalid");
    if(!academicEmail || !input.checkValidity()){
      input.setAttribute("aria-invalid", "true");
      $("hubAcademicEmailStatus").textContent = copy.academicEmailInvalid;
      $("hubAcademicEmailStatus").className = "hub-account-trust-status hub-academic-email-status error";
      input.focus();
      return;
    }
    const context = requestContext();
    hubState.academicEmailVerificationSending = true;
    hubState.academicEmailVerificationState = {
      ...(hubState.academicEmailVerificationState || {}),
      setupMissing:false,
      error:""
    };
    renderAccountTrustControls();
    const response = await academicEmailFunction("send", {academic_email:academicEmail});
    if(!contextIsCurrent(context)) return;
    hubState.academicEmailVerificationSending = false;
    if(response.error){
      const message = academicEmailUserError(response.error, copy);
      hubState.academicEmailVerificationState = {
        ...(hubState.academicEmailVerificationState || {}),
        setupMissing:String(response.error.code || "") === "verification_not_configured",
        error:message
      };
      renderAccountTrustControls();
      return;
    }
    const now = Date.now();
    hubState.academicEmailVerificationState = {
      data:{
        challenge_id:String(response.data.challenge_id || ""),
        masked_email:String(response.data.masked_email || ""),
        delivery_status:"sent",
        status:"sent",
        expires_at:new Date(now + Number(response.data.expires_in_seconds || 600) * 1000).toISOString(),
        resend_available_at:new Date(now + Number(response.data.resend_after_seconds || 60) * 1000).toISOString(),
        attempts_remaining:8,
        justSent:true
      },
      setupMissing:false,
      error:""
    };
    input.value = "";
    await Promise.all([loadMembership(), loadSchoolVerificationRequest()]);
    if(!contextIsCurrent(context)) return;
    scheduleAcademicEmailCooldown();
    renderAccountTrustControls();
    requestAnimationFrame(() => $("hubAcademicEmailCode")?.focus());
  }

  async function confirmAcademicEmailVerificationCode(){
    if(!authClient || !currentUser || hubState.academicEmailVerificationConfirming) return;
    const copy = accountTrustCopy();
    const codeInput = $("hubAcademicEmailCode");
    const code = codeInput.value.trim();
    const challengeId = String(
      hubState.academicEmailVerificationState?.data?.challenge_id || ""
    );
    codeInput.removeAttribute("aria-invalid");
    if(!challengeId || !/^\d{8}$/.test(code)){
      codeInput.setAttribute("aria-invalid", "true");
      $("hubAcademicEmailStatus").textContent = copy.academicEmailInvalidCode;
      $("hubAcademicEmailStatus").className = "hub-account-trust-status hub-academic-email-status error";
      codeInput.focus();
      return;
    }
    const context = requestContext();
    hubState.academicEmailVerificationConfirming = true;
    hubState.academicEmailVerificationState = {
      ...(hubState.academicEmailVerificationState || {}),
      error:""
    };
    renderAccountTrustControls();
    const response = await academicEmailFunction("confirm", {
      challenge_id:challengeId,
      code
    });
    if(!contextIsCurrent(context)) return;
    hubState.academicEmailVerificationConfirming = false;
    if(response.error){
      hubState.academicEmailVerificationState = {
        ...(hubState.academicEmailVerificationState || {}),
        error:academicEmailUserError(response.error, copy)
      };
      renderAccountTrustControls();
      return;
    }
    if(response.data.status === "invalid_code"){
      const attempts = Math.max(0, Number(response.data.attempts_remaining || 0));
      hubState.academicEmailVerificationState = {
        ...(hubState.academicEmailVerificationState || {}),
        data:{
          ...(hubState.academicEmailVerificationState?.data || {}),
          attempts_remaining:attempts
        },
        error:copy.academicEmailWrongCode.replace("{count}", String(attempts))
      };
      codeInput.value = "";
      renderAccountTrustControls();
      requestAnimationFrame(() => codeInput.focus());
      return;
    }
    if(response.data.status !== "verified" && response.data.status !== "submitted_for_review"){
      hubState.academicEmailVerificationState = {
        ...(hubState.academicEmailVerificationState || {}),
        error:copy.actionFailed
      };
      renderAccountTrustControls();
      return;
    }
    const verifiedImmediately = response.data.status === "verified";
    const verifiedAt = String(response.data.verified_at || new Date().toISOString());
    codeInput.value = "";
    hubState.academicEmailVerificationState = {
      data:{
        ...(hubState.academicEmailVerificationState?.data || {}),
        status:verifiedImmediately ? "verified" : "submitted_for_review",
        confirmed_at:verifiedAt,
        request_id:String(response.data.request_id || "")
      },
      setupMissing:false,
      error:""
    };
    if(verifiedImmediately){
      const responseMembership = response.data.membership && typeof response.data.membership === "object"
        ? response.data.membership
        : {};
      const verifiedMembership = {
        ...(hubState.membership || {}),
        ...responseMembership,
        status:"verified",
        verification_method:"academic_email",
        verified_at:verifiedAt
      };
      hubState.membership = verifiedMembership;
      if(hubState.schoolVerificationRequest?.data){
        hubState.schoolVerificationRequest = {
          ...hubState.schoolVerificationRequest,
          data:{
            ...hubState.schoolVerificationRequest.data,
            membership:verifiedMembership
          }
        };
      }
      renderIdentity();
      renderAccountTrustControls();
    }
    await Promise.all([
      loadSchoolVerificationRequest(),
      loadMembership(),
      loadAcademicEmailVerificationState()
    ]);
    if(contextIsCurrent(context)){
      const confirmed = isAcademicEmailVerifiedStudent();
      $("hubAcademicEmailStatus").textContent = confirmed
        ? copy.academicEmailConfirmedForReview
        : copy.academicEmailAwaitingCompletion;
      $("hubAcademicEmailStatus").className = `hub-account-trust-status hub-academic-email-status ${
        confirmed ? "success" : "warning"
      }`;
    }
  }

  async function retrySchoolVerificationLoad(){
    if(hubState.schoolVerificationLoading || hubState.academicEmailVerificationLoading) return;
    await Promise.all([
      loadSchoolVerificationRequest(),
      loadAcademicEmailVerificationState(),
      loadMembership()
    ]);
  }

  async function loadSchoolVerificationRequest(){
    ensureAccountTrustControls();
    if(!authClient || !currentUser) return null;
    const context = requestContext();
    hubState.schoolVerificationLoading = true;
    renderAccountTrustControls();
    let response;
    let enhancedError = null;
    try { response = await hubRpc("get_my_school_verification_v2"); }
    catch(error){ response = {data:null, error}; }
    let enhanced = !response.error;
    if(response.error){
      enhancedError = response.error;
      console.warn("Enhanced school verification status is unavailable; trying the compatible status endpoint.", {
        code:enhancedError?.code || "",
        message:enhancedError?.message || "",
        details:enhancedError?.details || ""
      });
      try { response = await hubRpc("get_my_school_verification"); }
      catch(error){ response = {data:null, error}; }
      enhanced = false;
    }
    if(!contextIsCurrent(context)) return null;
    hubState.schoolVerificationLoading = false;
    hubState.schoolVerificationEnhanced = enhanced && !response.error;
    if(response.error){
      if(enhancedError){
        console.warn("Both school verification status endpoints failed.", {
          enhanced:{
            code:enhancedError?.code || "",
            message:enhancedError?.message || ""
          },
          compatible:{
            code:response.error?.code || "",
            message:response.error?.message || ""
          }
        });
      }
      hubState.schoolVerificationRequest = {
        data:null,
        setupMissing:missingRpcError(response.error),
        error:missingRpcError(response.error) ? "" : schoolVerificationUserError(response.error)
      };
    } else {
      const data = parseJsonValue(response.data, response.data) || {};
      hubState.schoolVerificationRequest = {data, setupMissing:false, error:""};
      if(data.membership) hubState.membership = data.membership;
    }
    renderIdentity();
    renderAccountTrustControls();
    return hubState.schoolVerificationRequest;
  }

  async function loadAccountDeletionRequest(){
    ensureAccountTrustControls();
    if(!authClient || !currentUser) return null;
    const context = requestContext();
    hubState.accountDeletionLoading = true;
    renderAccountTrustControls();
    let response;
    try { response = await hubRpc("get_my_account_deletion_request"); }
    catch(error){ response = {data:null, error}; }
    if(!contextIsCurrent(context)) return null;
    hubState.accountDeletionLoading = false;
    hubState.accountDeletionRequest = response.error
      ? {
          data:null,
          setupMissing:missingRpcError(response.error),
          error:missingRpcError(response.error) ? "" : featureError(response.error)
        }
      : {data:parseJsonValue(response.data, response.data), setupMissing:false, error:""};
    renderAccountTrustControls();
    return hubState.accountDeletionRequest;
  }

  async function loadSupportRequests(){
    ensureAccountTrustControls();
    if(!authClient || !currentUser) return [];
    const context = requestContext();
    hubState.supportRequestsLoading = true;
    renderAccountTrustControls();
    let response;
    try { response = await hubRpc("get_my_concourse_support_requests"); }
    catch(error){ response = {data:null, error}; }
    if(!contextIsCurrent(context)) return [];
    hubState.supportRequestsLoading = false;
    if(response.error){
      hubState.supportRequests = [];
      const copy = accountTrustCopy();
      $("hubSupportRequestStatus").textContent = missingRpcError(response.error)
        ? copy.supportUnavailable
        : featureError(response.error);
      $("hubSupportRequestStatus").className = "hub-account-trust-status error";
    } else {
      const payload = parseJsonValue(response.data, response.data);
      hubState.supportRequests = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.requests) ? payload.requests : []);
      $("hubSupportRequestStatus").textContent = "";
      $("hubSupportRequestStatus").className = "hub-account-trust-status";
    }
    renderAccountTrustControls();
    return hubState.supportRequests;
  }

  async function submitSupportRequest(){
    if(hubState.supportRequestSubmitting || !authClient || !currentUser) return;
    const copy = accountTrustCopy();
    const category = $("hubSupportCategory").value;
    const subject = $("hubSupportSubject").value.trim();
    const details = $("hubSupportDetails").value.trim();
    if(!subject || details.length < 10){
      $("hubSupportRequestStatus").textContent = copy.supportRequired;
      $("hubSupportRequestStatus").className = "hub-account-trust-status error";
      (subject ? $("hubSupportDetails") : $("hubSupportSubject")).focus();
      return;
    }
    const context = requestContext();
    hubState.supportRequestSubmitting = true;
    renderAccountTrustControls();
    let response;
    try {
      response = await hubRpc("submit_concourse_support_request", {
        p_request_type:category,
        p_subject:subject,
        p_details:details
      });
    } catch(error){ response = {error}; }
    if(!contextIsCurrent(context)) return;
    hubState.supportRequestSubmitting = false;
    if(response.error){
      $("hubSupportRequestStatus").textContent = missingRpcError(response.error)
        ? copy.supportUnavailable
        : featureError(response.error);
      $("hubSupportRequestStatus").className = "hub-account-trust-status error";
      renderAccountTrustControls();
      return;
    }
    $("hubSupportSubject").value = "";
    $("hubSupportDetails").value = "";
    await loadSupportRequests();
    if(!contextIsCurrent(context)) return;
    $("hubSupportRequestStatus").textContent = copy.supportSubmitted;
    $("hubSupportRequestStatus").className = "hub-account-trust-status success";
  }

  async function discardSchoolVerificationReservations(reservations){
    const items = Array.isArray(reservations) ? reservations : [];
    const paths = items.map(item => item.storagePath).filter(Boolean);
    if(paths.length && authClient){
      try {
        const removal = await authClient.storage.from(SCHOOL_VERIFICATION_EVIDENCE_BUCKET).remove(paths);
        if(removal.error) console.warn("Private verification evidence cleanup was deferred.", removal.error);
      } catch(error){
        console.warn("Private verification evidence cleanup was deferred.", error);
      }
    }
    await Promise.all(items.map(async item => {
      if(!item.evidenceId) return;
      try {
        await hubRpc("discard_school_verification_evidence_reservation", {p_evidence_id:item.evidenceId});
      } catch(_error){}
    }));
  }

  async function uploadSchoolVerificationEvidence(context){
    const copy = accountTrustCopy();
    const reservations = [];
    const files = [...hubState.schoolVerificationFiles];
    try {
      for(const [index, item] of files.entries()){
        if(!contextIsCurrent(context)) throw new Error("Stale verification submission");
        $("hubSchoolVerificationStatus").textContent = copy.evidenceUploading
          .replace("{current}", String(index + 1))
          .replace("{total}", String(files.length));
        $("hubSchoolVerificationStatus").className = "hub-account-trust-status";
        let reservation;
        try {
          reservation = await hubRpc("reserve_school_verification_evidence", {
            p_document_type:item.documentType,
            p_original_file_name:item.name,
            p_mime_type:item.mimeType,
            p_size_bytes:item.sizeBytes
          });
        } catch(error){
          reservation = {data:null, error};
        }
        if(reservation.error) throw reservation.error;
        const payload = parseJsonValue(reservation.data, reservation.data) || {};
        const evidenceId = String(payload.evidence_id || payload.id || "");
        const storagePath = String(payload.storage_path || "");
        if(!evidenceId || !storagePath) throw new Error(copy.evidenceUploadFailed);
        const record = {evidenceId, storagePath};
        reservations.push(record);
        let upload;
        try {
          upload = await authClient.storage.from(SCHOOL_VERIFICATION_EVIDENCE_BUCKET).upload(storagePath, item.file, {
            upsert:false,
            contentType:item.mimeType,
            cacheControl:"0"
          });
        } catch(error){
          throw error;
        }
        if(upload.error) throw upload.error;
        $("hubSchoolVerificationStatus").textContent = copy.evidenceValidating
          .replace("{current}", String(index + 1))
          .replace("{total}", String(files.length));
        $("hubSchoolVerificationStatus").className = "hub-account-trust-status";
        let validation;
        try {
          validation = await authClient.functions.invoke(
            "validate-school-verification-evidence",
            {body:{evidence_id:evidenceId}}
          );
        } catch(error){
          validation = {data:null, error};
        }
        const validationPayload = parseJsonValue(validation.data, validation.data) || {};
        if(validation.error || validationPayload.status !== "validated"){
          throw new Error(copy.evidenceValidationUnavailable);
        }
      }
      return reservations;
    } catch(error){
      await discardSchoolVerificationReservations(reservations);
      throw error;
    }
  }

  async function submitSchoolVerification(){
    if(hubState.schoolVerificationLoading || !authClient || !currentUser) return;
    const copy = accountTrustCopy();
    const method = $("hubVerificationMethod").value;
    const reference = $("hubVerificationReference").value.trim();
    const note = $("hubVerificationNote").value.trim();
    ["hubVerificationReference", "hubVerificationFiles", "hubVerificationRedaction"].forEach(id => {
      $(id)?.removeAttribute("aria-invalid");
    });
    if(method === "institution_sso" && !reference){
      $("hubSchoolVerificationStatus").textContent = copy.requiredReference;
      $("hubSchoolVerificationStatus").className = "hub-account-trust-status error";
      $("hubVerificationReference").setAttribute("aria-invalid", "true");
      $("hubVerificationReference").focus();
      return;
    }
    if(method === "student_document" && !hubState.schoolVerificationFiles.length){
      $("hubSchoolVerificationStatus").textContent = copy.requiredEvidence;
      $("hubSchoolVerificationStatus").className = "hub-account-trust-status error";
      $("hubVerificationFiles").setAttribute("aria-invalid", "true");
      $("hubVerificationChooseFiles").focus();
      return;
    }
    if(method === "student_document" && !$("hubVerificationRedaction").checked){
      $("hubSchoolVerificationStatus").textContent = copy.requiredRedaction;
      $("hubSchoolVerificationStatus").className = "hub-account-trust-status error";
      $("hubVerificationRedaction").setAttribute("aria-invalid", "true");
      $("hubVerificationRedaction").focus();
      return;
    }
    const context = requestContext();
    hubState.schoolVerificationLoading = true;
    renderAccountTrustControls();
    let reservations = [];
    let response;
    try {
      if(method === "student_document"){
        if(!hubState.schoolVerificationEnhanced) throw new Error(copy.verificationEvidenceUnavailable);
        reservations = await uploadSchoolVerificationEvidence(context);
      }
      response = await hubRpc("submit_school_verification_request_v2", {
        p_submission_method:method,
        p_evidence_reference:reference || null,
        p_user_note:note || null,
        p_evidence_ids:reservations.map(item => item.evidenceId),
        p_redaction_confirmed:method === "student_document" ? $("hubVerificationRedaction").checked : false
      });
      if(response.error && missingRpcError(response.error) && method !== "student_document"){
        response = await hubRpc("submit_school_verification_request", {
          p_evidence_kind:method,
          p_evidence_reference:reference || null,
          p_user_note:note || null
        });
      }
    } catch(error){ response = {error}; }
    if(!contextIsCurrent(context)){
      if(reservations.length) await discardSchoolVerificationReservations(reservations);
      return;
    }
    hubState.schoolVerificationLoading = false;
    if(response.error){
      if(reservations.length) await discardSchoolVerificationReservations(reservations);
      const validationFailed = errorText(response.error).includes(copy.evidenceValidationUnavailable);
      hubState.schoolVerificationRequest = {
        ...(hubState.schoolVerificationRequest || {}),
        setupMissing:false,
        error:validationFailed
          ? copy.evidenceValidationUnavailable
          : (
            missingRpcError(response.error) && method === "student_document"
              ? copy.verificationEvidenceUnavailable
              : schoolVerificationUserError(response.error, copy)
          )
      };
      renderAccountTrustControls();
      return;
    }
    hubState.schoolVerificationFiles = [];
    $("hubVerificationReference").value = "";
    $("hubVerificationNote").value = "";
    $("hubVerificationRedaction").checked = false;
    await Promise.all([loadSchoolVerificationRequest(), loadMembership()]);
    if(contextIsCurrent(context)){
      $("hubSchoolVerificationStatus").textContent = copy.requestSubmitted;
      $("hubSchoolVerificationStatus").className = "hub-account-trust-status success";
    }
  }

  async function withdrawSchoolVerification(){
    const requestId = hubState.schoolVerificationRequest?.data?.latest_request?.request_id;
    if(!requestId || hubState.schoolVerificationLoading) return;
    const context = requestContext();
    hubState.schoolVerificationLoading = true;
    renderAccountTrustControls();
    let response;
    try { response = await hubRpc("withdraw_school_verification_request", {p_request_id:requestId}); }
    catch(error){ response = {error}; }
    if(!contextIsCurrent(context)) return;
    hubState.schoolVerificationLoading = false;
    if(response.error){
      hubState.schoolVerificationRequest = {
        ...hubState.schoolVerificationRequest,
        error:schoolVerificationUserError(response.error)
      };
      renderAccountTrustControls();
      return;
    }
    await loadSchoolVerificationRequest();
    if(contextIsCurrent(context)){
      $("hubSchoolVerificationStatus").textContent = accountTrustCopy().requestWithdrawn;
      $("hubSchoolVerificationStatus").className = "hub-account-trust-status success";
    }
  }

  async function requestAccountDeletion(){
    if(hubState.accountDeletionLoading || !authClient || !currentUser) return;
    const copy = accountTrustCopy();
    const reason = await requestHubAction({
      title:copy.requestDeletion,
      message:copy.deletionReason,
      input:true,
      inputRequired:false,
      maxLength:1000,
      confirmLabel:copy.requestDeletion,
      danger:true
    });
    if(reason === null) return;
    const context = requestContext();
    hubState.accountDeletionLoading = true;
    renderAccountTrustControls();
    let response;
    try { response = await hubRpc("request_account_deletion", {p_reason:String(reason || "").trim() || null}); }
    catch(error){ response = {error}; }
    if(!contextIsCurrent(context)) return;
    hubState.accountDeletionLoading = false;
    if(response.error){
      hubState.accountDeletionRequest = {data:null, setupMissing:missingRpcError(response.error), error:featureError(response.error)};
      renderAccountTrustControls();
      return;
    }
    await loadAccountDeletionRequest();
    if(contextIsCurrent(context)){
      $("hubAccountDeletionStatus").textContent = copy.deletionRequested;
      $("hubAccountDeletionStatus").className = "hub-account-trust-status success";
    }
  }

  async function cancelAccountDeletion(){
    if(hubState.accountDeletionLoading || !authClient || !currentUser) return;
    const copy = accountTrustCopy();
    const confirmed = await requestHubAction({
      title:copy.cancelDeletion,
      message:copy.deletionScheduled.replace(
        "{date}",
        formatDate(hubState.accountDeletionRequest?.data?.scheduled_for)
      ),
      confirmLabel:copy.cancelDeletion
    });
    if(!confirmed) return;
    const context = requestContext();
    hubState.accountDeletionLoading = true;
    renderAccountTrustControls();
    let response;
    try { response = await hubRpc("cancel_account_deletion_request"); }
    catch(error){ response = {error}; }
    if(!contextIsCurrent(context)) return;
    hubState.accountDeletionLoading = false;
    if(response.error){
      hubState.accountDeletionRequest = {...hubState.accountDeletionRequest, error:featureError(response.error)};
      renderAccountTrustControls();
      return;
    }
    await loadAccountDeletionRequest();
    if(contextIsCurrent(context)){
      $("hubAccountDeletionStatus").textContent = copy.deletionRequestCancelled;
      $("hubAccountDeletionStatus").className = "hub-account-trust-status success";
    }
  }

  function renderAdminAccess(){
    const badge = $("hubAdminRoleBadge");
    const navigation = $("hubOwnerConsoleNav");
    if(!badge || !navigation) return;
    const allowed = canReviewSchoolVerifications();
    badge.hidden = !allowed;
    navigation.hidden = !allowed;
    if(!allowed){
      badge.textContent = "";
      navigation.removeAttribute("aria-current");
      navigation.classList.remove("active");
      return;
    }
    const copy = ownerConsoleCopy();
    const role = adminRoleLabel();
    badge.textContent = role;
    badge.className = `hub-admin-role-badge ${hubState.adminRole}`;
    $("hubOwnerConsoleNavLabel").textContent = copy.nav;
  }

  async function loadAdminContext({force=false}={}){
    if(!authClient || !currentUser){
      hubState.adminContextUserId = null;
      hubState.adminRole = "";
      hubState.adminCapabilities = new Set();
      hubState.adminContextLoading = false;
      renderAdminAccess();
      return null;
    }
    if(!force && hubState.adminContextUserId === currentUser.id) return hubState.adminRole;
    if(hubState.adminContextLoading) return null;
    const context = requestContext();
    hubState.adminContextLoading = true;
    renderAdminAccess();
    let response;
    try { response = await hubRpc("get_my_concourse_admin_context"); }
    catch(error){ response = {data:null, error}; }
    if(!contextIsCurrent(context)) return null;
    hubState.adminContextLoading = false;
    hubState.adminContextUserId = context.userId;
    const payload = response.error ? null : (parseJsonValue(response.data, response.data) || {});
    const role = String(payload?.role || payload?.admin_role || "").trim().toLocaleLowerCase();
    // Keep the original role assignment readable for older installations,
    // then extend access through the capability set returned by the new RPC.
    hubState.adminRole = payload?.is_admin === false || !["owner", "reviewer"].includes(role) ? "" : role;
    hubState.adminCapabilities = normalizeAdminCapabilities(payload || {}, role);
    if(
      payload?.is_admin !== false
      && (hubState.adminCapabilities.size || ["owner", "reviewer", "privacy"].includes(role))
    ){
      hubState.adminRole = role || "reviewer";
    }
    if(!hubState.adminRole){
      hubState.adminQueue = [];
      hubState.adminQueueError = "";
      hubState.adminQueueNotice = "";
      hubState.verificationCounts = {};
      hubState.verificationCases = [];
      hubState.verificationTeam = [];
      if(hubState.activeView === "owner-console") void switchView("community");
    } else {
      const current = VERIFICATION_WORKFLOWS.find(workflow => workflow.id === hubState.verificationWorkflow);
      if(!current || !hasAdminCapability(current.scope)){
        hubState.verificationWorkflow = (
          VERIFICATION_WORKFLOWS.find(workflow => hasAdminCapability(workflow.scope))?.id
          || (hasAdminCapability("team.manage") ? "admin_team" : "school_verification")
        );
      }
    }
    renderAdminAccess();
    renderVerificationCenter();
    return hubState.adminRole;
  }

  function adminDetail(copy, label, value){
    const wrapper = node("div", "hub-admin-detail");
    wrapper.append(node("dt", "", label), node("dd", "", value || copy.noValue));
    return wrapper;
  }

  function adminStatusLabel(status, copy=ownerConsoleCopy()){
    const keys = {
      submitted:"statusSubmitted",
      under_review:"statusUnderReview",
      approved:"statusApproved",
      rejected:"statusRejected",
      withdrawn:"statusWithdrawn",
      all:"statusAll",
      open:"statusOpen",
      reviewing:"statusReviewing",
      verified:"statusVerified",
      evidence_accepted:"statusEvidenceAccepted",
      cancelled:"statusCancelled",
      processing:"statusProcessing",
      completed:"statusCompleted",
      resolved:"statusResolved",
      dismissed:"statusDismissed",
      awaiting_user:"statusAwaitingUser",
      closed:"statusClosed",
      resolved_buyer:"statusResolvedBuyer",
      resolved_seller:"statusResolvedSeller"
    };
    return copy[keys[status]] || String(status || copy.noValue);
  }

  function adminMethodLabel(method, copy=ownerConsoleCopy()){
    if(method === "academic_email") return copy.academicEmail;
    if(method === "institution_sso") return copy.institutionSso;
    return copy.manualReview;
  }

  function summaryMetricLabel(key){
    return String(key || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, character => character.toLocaleUpperCase());
  }

  function renderOwnerOperationalSummary(){
    const section = $("ownerOperationalSummary");
    if(!section) return;
    const copy = ownerConsoleCopy();
    const isOwner = hasAdminCapability("owner_summary.view");
    section.hidden = !isOwner;
    if(!isOwner) return;
    $("ownerOperationalSummaryKicker").textContent = copy.summaryKicker;
    $("ownerOperationalSummaryTitle").textContent = copy.summaryTitle;
    $("refreshOwnerOperationalSummary").textContent = copy.summaryRefresh;
    $("refreshOwnerOperationalSummary").disabled = hubState.ownerSummaryLoading;
    if(hubState.ownerSummaryLoading) setStatus("ownerOperationalSummaryStatus", copy.summaryLoading);
    else if(hubState.ownerSummaryError) setStatus("ownerOperationalSummaryStatus", hubState.ownerSummaryError, "error");
    else setStatus("ownerOperationalSummaryStatus", "");
    const grid = $("ownerOperationalSummaryGrid");
    grid.replaceChildren();
    if(hubState.ownerSummaryLoading || hubState.ownerSummaryError || !hubState.ownerSummary) return;
    const groups = [
      ["accounts", copy.summaryAccounts],
      ["school_verification", copy.summaryVerification],
      ["account_deletion", copy.summaryDeletion],
      ["community", copy.summaryCommunity],
      ["marketplace", copy.summaryMarketplace],
      ["messaging", copy.summaryMessaging]
    ];
    groups.forEach(([key, label]) => {
      const raw = hubState.ownerSummary?.[key];
      const values = raw && typeof raw === "object" && !Array.isArray(raw)
        ? Object.entries(raw).filter(([, value]) => Number.isFinite(Number(value)))
        : [];
      const preferred = ["total", "count", "all", "users", "accounts", "requests", "posts", "listings", "conversations"]
        .map(name => values.find(([keyName]) => keyName === name))
        .find(Boolean);
      const total = Number.isFinite(Number(raw))
        ? Number(raw)
        : (preferred ? Number(preferred[1]) : values.reduce((sum, [, value]) => sum + Number(value), 0));
      const card = node("article", "hub-owner-summary-card");
      card.append(node("span", "", label), node("strong", "", Number.isFinite(total) ? total.toLocaleString(locale()) : "—"));
      const details = node("dl");
      values
        .filter(([name]) => name !== preferred?.[0])
        .slice(0, 4)
        .forEach(([name, value]) => {
          const row = node("div");
          row.append(node("dt", "", summaryMetricLabel(name)), node("dd", "", Number(value).toLocaleString(locale())));
          details.append(row);
        });
      if(details.childElementCount) card.append(details);
      grid.append(card);
    });
  }

  function renderOwnerConsole(){
    const view = $("hubOwnerConsoleView");
    if(!view) return;
    const copy = ownerConsoleCopy();
    $("ownerConsoleKicker").textContent = copy.kicker;
    $("ownerConsoleTitle").textContent = copy.title;
    $("ownerConsoleDescription").textContent = copy.intro;
    $("ownerVerificationQueueKicker").textContent = copy.queueKicker;
    $("ownerVerificationQueueTitle").textContent = copy.queueTitle;
    $("ownerVerificationQueueDescription").textContent = copy.queueDescription;
    $("ownerVerificationStatusLabel").textContent = copy.requestStatus;
    $("refreshOwnerVerificationQueue").textContent = copy.refresh;
    $("ownerVerificationEmptyTitle").textContent = copy.queueClear;
    $("ownerVerificationEmptyDescription").textContent = copy.noRequests;
    const filter = $("ownerVerificationStatusFilter");
    const statusKeys = {
      submitted:"statusSubmitted",
      under_review:"statusUnderReview",
      approved:"statusApproved",
      rejected:"statusRejected",
      withdrawn:"statusWithdrawn"
    };
    [...filter.options].forEach(option => { option.textContent = copy[statusKeys[option.value]]; });
    filter.value = hubState.adminQueueStatus;
    const role = canReviewSchoolVerifications() ? adminRoleLabel() : "";
    $("ownerConsoleAccessMark").textContent = role ? copy.access.replace("{role}", role) : "";
    renderOwnerOperationalSummary();

    const queue = $("ownerVerificationQueue");
    const empty = $("ownerVerificationEmpty");
    queue.replaceChildren();
    const allowed = canReviewSchoolVerifications();
    filter.disabled = !allowed || hubState.adminQueueLoading;
    $("refreshOwnerVerificationQueue").disabled = !allowed || hubState.adminQueueLoading;
    if(hubState.adminQueueLoading){
      setStatus("ownerVerificationQueueStatus", copy.loading);
    } else if(hubState.adminQueueError){
      setStatus("ownerVerificationQueueStatus", hubState.adminQueueError, "error");
    } else if(hubState.adminQueueNotice){
      setStatus("ownerVerificationQueueStatus", hubState.adminQueueNotice, hubState.adminQueueNoticeKind);
    } else {
      setStatus("ownerVerificationQueueStatus", "");
    }
    if(!allowed){
      empty.hidden = true;
      return;
    }
    const requests = Array.isArray(hubState.adminQueue) ? hubState.adminQueue : [];
    empty.hidden = hubState.adminQueueLoading || Boolean(hubState.adminQueueError) || requests.length > 0;
    if(hubState.adminQueueLoading || hubState.adminQueueError) return;

    requests.forEach(request => {
      const requestId = String(request?.request_id || "");
      if(!requestId) return;
      const status = String(request.status || hubState.adminQueueStatus);
      const card = node("article", "hub-admin-request");
      card.setAttribute("role", "listitem");
      card.dataset.requestId = requestId;
      const header = node("header", "hub-admin-request-heading");
      const headingCopy = node("div");
      headingCopy.append(
        node("h4", "", request.school_name || copy.noValue),
        node("p", "", request.account_email || copy.noValue)
      );
      const statusBadge = node("span", `hub-admin-request-status ${status.replace(/[^a-z_]/g, "")}`, adminStatusLabel(status, copy));
      statusBadge.setAttribute("aria-label", `${copy.statusLabel}: ${adminStatusLabel(status, copy)}`);
      header.append(headingCopy, statusBadge);

      const details = node("dl", "hub-admin-details");
      details.append(
        adminDetail(copy, copy.account, request.account_email),
        adminDetail(copy, copy.schoolKey, request.school_key),
        adminDetail(copy, copy.evidenceMethod, adminMethodLabel(request.evidence_kind, copy)),
        adminDetail(copy, copy.evidenceReference, request.evidence_reference),
        adminDetail(copy, copy.submittedAt, formatDate(request.submitted_at))
      );
      if(request.reviewed_at) details.append(adminDetail(copy, copy.reviewedAt, formatDate(request.reviewed_at)));

      const applicantNote = node("section", "hub-admin-note");
      applicantNote.append(node("h5", "", copy.applicantNote), node("p", "", request.user_note || copy.noValue));
      card.append(header, details, applicantNote);

      if(["submitted", "under_review"].includes(status)){
        const review = node("div", "hub-admin-review");
        const methodLabel = node("label");
        methodLabel.append(node("span", "", copy.decisionMethod));
        const method = node("select", "hub-admin-review-method");
        [
          ["manual", copy.manualReview],
          ["academic_email", copy.academicEmail],
          ["institution_sso", copy.institutionSso]
        ].forEach(([value, label]) => {
          const option = node("option", "", label);
          option.value = value;
          method.append(option);
        });
        method.value = request.evidence_kind === "academic_email" || request.evidence_kind === "institution_sso"
          ? request.evidence_kind
          : "manual";
        methodLabel.append(method);
        const noteLabel = node("label", "hub-admin-review-note");
        noteLabel.append(node("span", "", copy.reviewerNote));
        const note = node("textarea");
        note.maxLength = 1000;
        note.placeholder = copy.notePlaceholder;
        note.value = request.reviewer_note || "";
        noteLabel.append(note);
        const actions = node("div", "hub-admin-review-actions");
        const approve = node("button", "btn-primary", copy.approve);
        approve.type = "button";
        const reject = node("button", "btn-ghost hub-admin-reject", copy.reject);
        reject.type = "button";
        const busy = hubState.adminReviewBusy.has(requestId);
        method.disabled = busy;
        note.disabled = busy;
        approve.disabled = busy;
        reject.disabled = busy;
        approve.onclick = () => void reviewSchoolVerification(request, "approve", method.value, note.value, note);
        reject.onclick = () => void reviewSchoolVerification(request, "reject", method.value, note.value, note);
        actions.append(approve, reject);
        review.append(methodLabel, noteLabel, actions);
        card.append(review);
      } else if(request.reviewer_note){
        const reviewerNote = node("section", "hub-admin-note hub-admin-reviewer-note");
        reviewerNote.append(node("h5", "", copy.reviewerNote), node("p", "", request.reviewer_note));
        card.append(reviewerNote);
      }
      queue.append(card);
    });
  }

  async function loadOwnerOperationalSummary({force=false}={}){
    if(!hasAdminCapability("owner_summary.view") || !authClient || !currentUser) return null;
    if(hubState.ownerSummaryLoading && !force) return hubState.ownerSummary;
    const context = requestContext();
    hubState.ownerSummaryLoading = true;
    hubState.ownerSummaryError = "";
    renderOwnerOperationalSummary();
    let response;
    try { response = await hubRpc("get_concourse_owner_summary"); }
    catch(error){ response = {data:null, error}; }
    if(!contextIsCurrent(context)) return null;
    hubState.ownerSummaryLoading = false;
    if(response.error){
      hubState.ownerSummary = null;
      hubState.ownerSummaryError = missingRpcError(response.error)
        ? ownerConsoleCopy().unavailable
        : ownerConsoleCopy().summaryUnavailable;
    } else {
      const payload = parseJsonValue(response.data, response.data);
      hubState.ownerSummary = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
      hubState.ownerSummaryError = "";
    }
    renderOwnerOperationalSummary();
    return hubState.ownerSummary;
  }

  async function loadOwnerConsoleQueue({force=false}={}){
    if(!canReviewSchoolVerifications() || !authClient || !currentUser) return [];
    if(hubState.adminQueueLoading && !force) return hubState.adminQueue;
    const context = requestContext();
    hubState.adminQueueStatus = $("ownerVerificationStatusFilter")?.value || hubState.adminQueueStatus;
    hubState.adminQueueLoading = true;
    hubState.adminQueueError = "";
    hubState.adminQueueNotice = "";
    renderOwnerConsole();
    let response;
    try {
      response = await hubRpc("get_school_verification_review_queue", {
        p_status:hubState.adminQueueStatus,
        p_limit:50
      });
    } catch(error){ response = {data:null, error}; }
    if(!contextIsCurrent(context)) return [];
    hubState.adminQueueLoading = false;
    if(response.error){
      const raw = errorText(response.error);
      hubState.adminQueue = [];
      hubState.adminQueueError = missingRpcError(response.error)
        ? ownerConsoleCopy().unavailable
        : (/Administrator access required/i.test(raw) ? ownerConsoleCopy().denied : featureError(response.error));
    } else {
      const payload = parseJsonValue(response.data, response.data);
      hubState.adminQueue = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.requests) ? payload.requests : (Array.isArray(payload?.queue) ? payload.queue : []));
      hubState.adminQueueError = "";
    }
    renderOwnerConsole();
    return hubState.adminQueue;
  }

  async function reviewSchoolVerification(request, decision, method, reviewerNote, noteInput){
    if(!canReviewSchoolVerifications() || !request?.request_id) return;
    const copy = ownerConsoleCopy();
    const requestId = String(request.request_id);
    const note = String(reviewerNote || "").trim();
    if(decision === "reject" && !note){
      hubState.adminQueueNotice = copy.rejectNoteRequired;
      hubState.adminQueueNoticeKind = "error";
      renderOwnerConsole();
      const restored = document.querySelector(`[data-request-id="${CSS.escape(requestId)}"] .hub-admin-review-note textarea`);
      (restored || noteInput)?.focus();
      return;
    }
    const confirmed = await requestHubAction({
      title:decision === "approve" ? copy.approveTitle : copy.rejectTitle,
      message:decision === "approve" ? copy.approveConfirm : copy.rejectConfirm,
      confirmLabel:decision === "approve" ? copy.approve : copy.reject,
      danger:decision === "reject"
    });
    if(!confirmed) return;
    const context = requestContext();
    hubState.adminReviewBusy.add(requestId);
    hubState.adminQueueNotice = copy.savingDecision;
    hubState.adminQueueNoticeKind = "";
    renderOwnerConsole();
    let response;
    try {
      response = await hubRpc("review_school_verification_request", {
        p_request_id:requestId,
        p_decision:decision,
        p_verification_method:method || "manual",
        p_reviewer_note:note || null
      });
    } catch(error){ response = {error}; }
    if(!contextIsCurrent(context)) return;
    hubState.adminReviewBusy.delete(requestId);
    if(response.error){
      hubState.adminQueueNotice = missingRpcError(response.error) ? copy.unavailable : copy.decisionFailed;
      hubState.adminQueueNoticeKind = "error";
      renderOwnerConsole();
      return;
    }
    await loadOwnerConsoleQueue({force:true});
    if(!contextIsCurrent(context)) return;
    hubState.adminQueueNotice = decision === "approve" ? copy.approved : copy.rejected;
    hubState.adminQueueNoticeKind = "success";
    renderOwnerConsole();
  }

  function verificationWorkflowDefinition(workflowId=hubState.verificationWorkflow){
    return VERIFICATION_WORKFLOWS.find(workflow => workflow.id === workflowId) || null;
  }

  function verificationWorkflowAllowed(workflowId){
    if(workflowId === "admin_team") return hasAdminCapability("team.manage");
    const workflow = verificationWorkflowDefinition(workflowId);
    return !!workflow && hasAdminCapability(workflow.scope);
  }

  function verificationWorkflowLabel(workflowId, copy=ownerConsoleCopy()){
    if(workflowId === "admin_team") return copy.workflowTeam;
    const workflow = verificationWorkflowDefinition(workflowId);
    return workflow ? copy[workflow.labelKey] : copy.queueTitle;
  }

  function verificationWorkflowDescription(workflowId, copy=ownerConsoleCopy()){
    const keys = {
      school_verification:"workflowSchoolDescription",
      payment_evidence:"workflowPaymentsDescription",
      marketplace_dispute:"workflowDisputesDescription",
      marketplace_report:"workflowMarketReportsDescription",
      content_report:"workflowContentReportsDescription",
      account_deletion:"workflowDeletionDescription",
      support_request:"workflowSupportDescription"
    };
    return copy[keys[workflowId]] || copy.queueDescription;
  }

  function verificationDefaultStatus(workflowId){
    return VERIFICATION_STATUS_KEYS[workflowId]?.[0] || "submitted";
  }

  function verificationStatusOptions(workflowId){
    return VERIFICATION_STATUS_KEYS[workflowId] || ["submitted"];
  }

  function verificationCountValue(workflowId){
    const raw = hubState.verificationCounts?.[workflowId];
    if(Number.isFinite(Number(raw))) return Number(raw);
    if(!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
    for(const key of ["actionable", "pending", "needs_review", "count"]){
      if(Number.isFinite(Number(raw[key]))) return Number(raw[key]);
    }
    const statuses = verificationStatusOptions(workflowId).slice(0, 2);
    const statusTotal = statuses.reduce((sum, status) => (
      sum + (Number.isFinite(Number(raw[status])) ? Number(raw[status]) : 0)
    ), 0);
    if(statusTotal) return statusTotal;
    return Number.isFinite(Number(raw.total)) ? Number(raw.total) : 0;
  }

  function renderVerificationTabs(){
    const copy = ownerConsoleCopy();
    const tablist = $("verificationCenterTabs");
    if(!tablist) return;
    VERIFICATION_WORKFLOWS.forEach(workflow => {
      const tab = $(workflow.tabId);
      if(!tab) return;
      const allowed = hasAdminCapability(workflow.scope);
      tab.hidden = !allowed;
      tab.querySelector("span").textContent = copy[workflow.labelKey];
      $(workflow.countId).textContent = verificationCountValue(workflow.id).toLocaleString(locale());
      const selected = allowed && hubState.verificationWorkflow === workflow.id;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      tab.tabIndex = selected ? 0 : -1;
    });
    const team = $("verificationTabTeam");
    if(team){
      const allowed = hasAdminCapability("team.manage");
      team.hidden = !allowed;
      $("verificationTabTeamLabel").textContent = copy.workflowTeam;
      const selected = allowed && hubState.verificationWorkflow === "admin_team";
      team.classList.toggle("active", selected);
      team.setAttribute("aria-selected", selected ? "true" : "false");
      team.tabIndex = selected ? 0 : -1;
    }
  }

  function verificationSafeValue(value){
    if(value === null || value === undefined || value === "") return "";
    if(typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    return "";
  }

  function verificationCaseId(record){
    return verificationSafeValue(
      record?.case_id
      || record?.request_id
      || record?.payment_evidence_id
      || record?.dispute_id
      || record?.report_id
      || record?.deletion_request_id
      || record?.support_request_id
      || record?.id
    );
  }

  function verificationCaseTitle(record, workflowId, copy=ownerConsoleCopy()){
    return verificationSafeValue(
      record?.title
      || record?.subject
      || record?.school_name
      || record?.listing_title
      || record?.target_title
      || record?.account_email
      || record?.requester_email
      || verificationWorkflowLabel(workflowId, copy)
    );
  }

  function verificationCaseSubtitle(record, copy=ownerConsoleCopy()){
    return verificationSafeValue(
      record?.requester_display_name
      || record?.display_name
      || record?.account_email
      || record?.requester_email
      || record?.reporter_username
      || record?.username
      || record?.user_id
      || copy.noValue
    );
  }

  function formatVerificationAmount(record){
    const minor = Number(record?.amount_minor ?? record?.gross_minor);
    const currency = verificationSafeValue(record?.currency).toLocaleUpperCase();
    if(!Number.isFinite(minor)) return "";
    try {
      return new Intl.NumberFormat(locale(), {
        style:"currency",
        currency:currency || "USD"
      }).format(minor / 100);
    } catch(_error){
      return `${currency || ""} ${(minor / 100).toFixed(2)}`.trim();
    }
  }

  function verificationCaseDetails(record, workflowId, copy=ownerConsoleCopy()){
    const common = [
      [copy.caseReference, verificationCaseId(record)],
      [copy.requester, verificationCaseSubtitle(record, copy)],
      [copy.created, formatDate(record?.created_at || record?.submitted_at || record?.requested_at)],
      [copy.updated, formatDate(record?.updated_at || record?.reviewed_at || record?.resolved_at)]
    ];
    const workflowFields = {
      school_verification:[
        [copy.school, record?.school_name],
        [copy.schoolKey, record?.school_key],
        [copy.evidenceMethod, adminMethodLabel(record?.evidence_kind, copy)],
        [copy.evidenceReference, record?.evidence_reference],
        [copy.applicantNote, record?.user_note]
      ],
      payment_evidence:[
        [copy.order, record?.order_id],
        [copy.listing, record?.listing_title],
        [copy.amount, formatVerificationAmount(record)],
        [copy.provider, record?.provider],
        [copy.paymentState, record?.payment_state],
        [copy.evidenceReference, record?.evidence_reference],
        [copy.applicantNote, record?.user_note || record?.details]
      ],
      marketplace_dispute:[
        [copy.order, record?.order_id],
        [copy.listing, record?.listing_title],
        [copy.amount, formatVerificationAmount(record)],
        [copy.paymentState, record?.payment_state],
        [copy.reason, record?.reason],
        [copy.details, record?.details]
      ],
      marketplace_report:[
        [copy.listing, record?.listing_title || record?.listing_id],
        [copy.reason, record?.reason],
        [copy.details, record?.details]
      ],
      content_report:[
        [copy.category, record?.target_type],
        [copy.caseReference, record?.target_id],
        [copy.reason, record?.reason],
        [copy.details, record?.details]
      ],
      account_deletion:[
        [copy.account, record?.account_email || record?.requester_email],
        [copy.reason, record?.reason],
        [copy.submittedAt, formatDate(record?.requested_at || record?.submitted_at)],
        [copy.updated, formatDate(record?.scheduled_for)]
      ],
      support_request:[
        [copy.category, record?.category],
        [copy.subject, record?.subject],
        [copy.details, record?.details],
        [copy.priority, record?.priority]
      ]
    };
    const seen = new Set();
    return [...common, ...(workflowFields[workflowId] || [])]
      .map(([label, value]) => [label, verificationSafeValue(value)])
      .filter(([label, value]) => {
        const key = `${label}:${value}`;
        if(!value || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function verificationActionLabel(action, copy=ownerConsoleCopy()){
    const keys = {
      start_review:"actionUnderReview",
      accept_evidence:"actionAcceptEvidence",
      recommend_refund:"actionRecommendRefund",
      recommend_release:"actionRecommendRelease",
      return_to_queue:"actionReturnToQueue",
      request_info:"actionRequestInfo",
      approve:"actionApprove",
      reject:"actionReject",
      verify:"actionVerify",
      resolve:"actionResolve",
      resolve_buyer:"actionResolveBuyer",
      resolve_seller:"actionResolveSeller",
      close:"actionClose",
      dismiss:"actionDismiss",
      processing:"actionProcessing",
      complete:"actionComplete",
      cancel:"actionCancel",
      escalate:"actionEscalate"
    };
    return copy[keys[action]] || summaryMetricLabel(action);
  }

  function verificationCaseActions(record, workflowId){
    if(Array.isArray(record?.allowed_actions)){
      return record.allowed_actions
        .map(action => verificationSafeValue(action))
        .filter(action => VERIFICATION_ACTIONS[workflowId]?.includes(action));
    }
    const terminal = new Set([
      "approved", "rejected", "withdrawn", "evidence_accepted", "cancelled", "completed",
      "resolved", "dismissed", "resolved_buyer", "resolved_seller", "closed"
    ]);
    return terminal.has(String(record?.status || "")) ? [] : (VERIFICATION_ACTIONS[workflowId] || []);
  }

  function verificationActionNeedsNote(action){
    return !["start_review", "approve", "accept_evidence", "return_to_queue"].includes(action);
  }

  async function openSchoolVerificationEvidence(item, caseId){
    const copy = ownerConsoleCopy();
    const preview = window.open("", "_blank");
    if(preview){
      try { preview.opener = null; }
      catch(_error){}
      preview.document.title = copy.evidenceLoading;
      preview.document.body.textContent = copy.evidenceLoading;
    }
    let authorization;
    try {
      authorization = await hubRpc("authorize_school_verification_evidence_access", {
        p_evidence_id:item.evidence_id
      });
    } catch(error){
      authorization = {data:null, error};
    }
    const authorizationPayload = parseJsonValue(authorization.data, authorization.data) || {};
    const storagePath = String(authorizationPayload.storage_path || "");
    if(authorization.error || !storagePath){
      if(preview) preview.close();
      const current = hubState.verificationEvidenceByCase.get(caseId) || {items:[]};
      hubState.verificationEvidenceByCase.set(caseId, {...current, error:copy.evidenceOpenFailed});
      renderVerificationCenter();
      return;
    }
    let signed;
    try {
      signed = await authClient.storage
        .from(SCHOOL_VERIFICATION_EVIDENCE_BUCKET)
        .createSignedUrl(storagePath, SCHOOL_VERIFICATION_EVIDENCE_TTL_SECONDS);
    } catch(error){
      signed = {data:null, error};
    }
    if(signed.error || !signed.data?.signedUrl){
      if(preview) preview.close();
      const current = hubState.verificationEvidenceByCase.get(caseId) || {items:[]};
      hubState.verificationEvidenceByCase.set(caseId, {...current, error:copy.evidenceOpenFailed});
      renderVerificationCenter();
      return;
    }
    if(preview) preview.location.replace(signed.data.signedUrl);
    else window.open(signed.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function loadSchoolVerificationCaseEvidence(caseId){
    if(!caseId || hubState.verificationEvidenceLoading.has(caseId) || !canReviewSchoolCases()) return;
    const context = requestContext();
    hubState.verificationEvidenceLoading.add(caseId);
    hubState.verificationEvidenceByCase.delete(caseId);
    renderVerificationCenter();
    let response;
    try {
      response = await hubRpc("get_school_verification_case_evidence", {p_request_id:caseId});
    } catch(error){ response = {data:null, error}; }
    if(!contextIsCurrent(context)) return;
    hubState.verificationEvidenceLoading.delete(caseId);
    if(response.error){
      hubState.verificationEvidenceByCase.set(caseId, {
        items:[],
        error:missingRpcError(response.error) ? ownerConsoleCopy().unavailable : featureError(response.error)
      });
    } else {
      const payload = parseJsonValue(response.data, response.data);
      hubState.verificationEvidenceByCase.set(caseId, {
        items:Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : []),
        error:""
      });
    }
    renderVerificationCenter();
  }

  function renderSchoolVerificationCaseEvidence(caseId){
    const copy = ownerConsoleCopy();
    const section = node("section", "hub-verification-private-evidence");
    const heading = node("div", "hub-verification-private-evidence-heading");
    heading.append(node("h5", "", copy.privateEvidence));
    const loaded = hubState.verificationEvidenceByCase.get(caseId);
    const loading = hubState.verificationEvidenceLoading.has(caseId);
    if(!loaded && !loading){
      const load = node("button", "btn-ghost", copy.loadEvidence);
      load.type = "button";
      load.onclick = () => void loadSchoolVerificationCaseEvidence(caseId);
      heading.append(load);
    }
    section.append(heading, node("p", "hub-verification-private-evidence-note", copy.evidencePrivacyNote));
    if(loading){
      const status = node("p", "hub-account-trust-status", copy.evidenceLoading);
      status.setAttribute("role", "status");
      section.append(status);
      return section;
    }
    if(!loaded) return section;
    if(loaded.error){
      section.append(node("p", "hub-account-trust-status error", loaded.error));
      return section;
    }
    if(!loaded.items.length){
      section.append(node("p", "hub-verification-private-evidence-empty", copy.evidenceNone));
      return section;
    }
    const list = node("div", "hub-verification-private-evidence-list");
    loaded.items.forEach(item => {
      const row = node("article", "hub-verification-private-evidence-file");
      const detail = node("div");
      detail.append(
        node("b", "", item.original_file_name || copy.privateEvidence),
        node("small", "", [
          schoolVerificationDocumentLabel(item.document_type, accountTrustCopy()),
          schoolVerificationFileSize(item.size_bytes),
          item.mime_type
        ].filter(Boolean).join(" · "))
      );
      const open = node("button", "btn-ghost", copy.openEvidence);
      open.type = "button";
      open.setAttribute("aria-label", `${copy.openEvidence}: ${item.original_file_name || copy.privateEvidence}`);
      open.onclick = () => void openSchoolVerificationEvidence(item, caseId);
      row.append(detail, open);
      list.append(row);
    });
    section.append(list);
    return section;
  }

  function renderVerificationCase(record){
    const copy = ownerConsoleCopy();
    const workflowId = hubState.verificationWorkflow;
    const caseId = verificationCaseId(record);
    if(!caseId) return null;
    const status = verificationSafeValue(record?.status || hubState.adminQueueStatus);
    const card = node("article", "hub-admin-request hub-verification-case");
    card.setAttribute("role", "listitem");
    card.dataset.requestId = caseId;
    card.dataset.caseId = caseId;
    const header = node("header", "hub-admin-request-heading");
    const headingCopy = node("div");
    headingCopy.append(
      node("h4", "", verificationCaseTitle(record, workflowId, copy)),
      node("p", "", verificationCaseSubtitle(record, copy))
    );
    const statusBadge = node(
      "span",
      `hub-admin-request-status ${status.replace(/[^a-z_]/g, "")}`,
      adminStatusLabel(status, copy)
    );
    statusBadge.setAttribute("aria-label", `${copy.statusLabel}: ${adminStatusLabel(status, copy)}`);
    header.append(headingCopy, statusBadge);
    const details = node("dl", "hub-admin-details");
    verificationCaseDetails(record, workflowId, copy).forEach(([label, value]) => {
      details.append(adminDetail(copy, label, value));
    });
    card.append(header, details);
    if(workflowId === "school_verification"){
      card.append(renderSchoolVerificationCaseEvidence(caseId));
    }
    if(record?.reviewer_note || record?.resolution_note || record?.admin_note){
      const previousNote = node("section", "hub-admin-note hub-admin-reviewer-note");
      previousNote.append(
        node("h5", "", copy.reviewerNote),
        node("p", "", record.reviewer_note || record.resolution_note || record.admin_note)
      );
      card.append(previousNote);
    }
    const availableActions = verificationCaseActions(record, workflowId);
    if(availableActions.length){
      const review = node("div", "hub-admin-review hub-verification-review");
      const noteLabel = node("label", "hub-admin-review-note");
      noteLabel.append(node("span", "", copy.decisionNote));
      const note = node("textarea");
      note.maxLength = workflowId === "school_verification" ? 1000 : 2000;
      note.placeholder = copy.decisionNotePlaceholder;
      note.value = record?.draft_note || "";
      noteLabel.append(note);
      const actions = node("div", "hub-admin-review-actions hub-verification-actions");
      const busy = hubState.adminReviewBusy.has(caseId);
      note.disabled = busy;
      availableActions.forEach(action => {
        const destructive = ["reject", "dismiss"].includes(action);
        const button = node("button", destructive ? "btn-ghost hub-admin-reject" : (["approve", "accept_evidence", "resolve"].includes(action) ? "btn-primary" : "btn-ghost"), verificationActionLabel(action, copy));
        button.type = "button";
        button.disabled = busy;
        button.dataset.verificationAction = action;
        button.onclick = () => void reviewVerificationCenterCase(record, action, note.value, note);
        actions.append(button);
      });
      review.append(noteLabel, actions);
      card.append(review);
    }
    return card;
  }

  function renderVerificationTeamCopy(){
    const copy = ownerConsoleCopy();
    const values = {
      verificationTeamKicker:copy.teamKicker,
      verificationTeamTitle:copy.teamTitle,
      verificationTeamDescription:copy.teamDescription,
      verificationTeamIdentifierLabel:copy.teamIdentifier,
      verificationTeamRoleLabel:copy.teamRole,
      verificationTeamScopesLabel:copy.teamScopes,
      verificationTeamAppoint:copy.teamAppoint,
      verificationScopeSchool:copy.workflowSchool,
      verificationScopePayments:copy.workflowPayments,
      verificationScopeDisputes:copy.workflowDisputes,
      verificationScopeMarketReports:copy.workflowMarketReports,
      verificationScopeContentReports:copy.workflowContentReports,
      verificationScopeDeletion:copy.workflowDeletion,
      verificationScopeSupport:copy.workflowSupport,
      verificationTeamEmptyTitle:copy.teamEmptyTitle,
      verificationTeamEmptyDescription:copy.teamEmptyDescription
    };
    Object.entries(values).forEach(([id, value]) => { if($(id)) $(id).textContent = value; });
    const role = $("verificationTeamRole");
    if(role){
      role.querySelector('[value="reviewer"]').textContent = copy.reviewerRole;
      role.querySelector('[value="privacy"]').textContent = copy.privacyRole;
    }
  }

  function createVerificationScopePicker(selectedScopes=[], {disabled=false}={}){
    const copy = ownerConsoleCopy();
    const selected = new Set(Array.isArray(selectedScopes) ? selectedScopes : []);
    const picker = node("fieldset", "hub-admin-scope-picker hub-admin-member-scopes");
    const legend = node("legend", "", copy.teamScopes);
    picker.append(legend);
    VERIFICATION_WORKFLOWS.forEach(workflow => {
      const label = node("label");
      const input = node("input");
      input.type = "checkbox";
      input.value = workflow.scope;
      input.checked = selected.has(workflow.scope);
      input.disabled = disabled;
      label.append(input, node("span", "", copy[workflow.labelKey]));
      picker.append(label);
    });
    return picker;
  }

  function renderVerificationTeam(){
    renderVerificationTeamCopy();
    const copy = ownerConsoleCopy();
    const list = $("verificationTeamList");
    const empty = $("verificationTeamEmpty");
    if(!list || !empty) return;
    list.replaceChildren();
    $("verificationTeamAppointmentForm").hidden = !hasAdminCapability("team.manage");
    if(hubState.verificationTeamLoading){
      setStatus("verificationTeamStatus", copy.teamLoading);
    } else if(hubState.verificationTeamError){
      setStatus("verificationTeamStatus", hubState.verificationTeamError, "error");
    } else if(!hubState.adminQueueNotice){
      setStatus("verificationTeamStatus", "");
    }
    empty.hidden = hubState.verificationTeamLoading || Boolean(hubState.verificationTeamError) || hubState.verificationTeam.length > 0;
    if(hubState.verificationTeamLoading || hubState.verificationTeamError) return;
    hubState.verificationTeam.forEach(member => {
      const userId = verificationSafeValue(member?.user_id || member?.id);
      if(!userId) return;
      const role = verificationSafeValue(member?.role || "reviewer");
      const isOwner = role === "owner";
      const busy = hubState.verificationTeamBusy.has(userId);
      const card = node("article", "hub-admin-member");
      card.setAttribute("role", "listitem");
      card.dataset.adminUserId = userId;
      const heading = node("header", "hub-admin-request-heading");
      const identity = node("div");
      identity.append(
        node("h4", "", member?.display_name || member?.username || member?.email || userId),
        node("p", "", member?.email || member?.username || userId)
      );
      heading.append(identity, node("span", `hub-admin-request-status ${role}`, isOwner ? copy.ownerRole : (role === "privacy" ? copy.privacyRole : copy.reviewerRole)));
      const scopes = Array.isArray(member?.scopes)
        ? member.scopes
        : (Array.isArray(member?.capabilities) ? member.capabilities : []);
      const picker = createVerificationScopePicker(scopes, {disabled:isOwner || busy});
      const roleLabel = node("label", "hub-admin-member-role");
      roleLabel.append(node("span", "", copy.teamRole));
      const roleSelect = node("select");
      [["reviewer", copy.reviewerRole], ["privacy", copy.privacyRole]].forEach(([value, label]) => {
        const option = node("option", "", label);
        option.value = value;
        roleSelect.append(option);
      });
      roleSelect.value = role === "privacy" ? "privacy" : "reviewer";
      roleSelect.disabled = isOwner || busy;
      roleLabel.append(roleSelect);
      const actions = node("div", "hub-admin-review-actions");
      if(!isOwner){
        const save = node("button", "btn-primary", copy.teamSave);
        save.type = "button";
        save.disabled = busy;
        save.onclick = () => void updateVerificationAdmin(member, roleSelect.value, verificationSelectedScopes(picker));
        const revoke = node("button", "btn-ghost hub-admin-reject", copy.teamRevoke);
        revoke.type = "button";
        revoke.disabled = busy;
        revoke.onclick = () => void revokeVerificationAdmin(member);
        actions.append(save, revoke);
      }
      card.append(heading, roleLabel, picker);
      if(actions.childElementCount) card.append(actions);
      list.append(card);
    });
  }

  function renderVerificationCenter(){
    const view = $("hubOwnerConsoleView");
    if(!view) return;
    const copy = ownerConsoleCopy();
    $("ownerConsoleKicker").textContent = copy.kicker;
    $("ownerConsoleTitle").textContent = copy.title;
    $("ownerConsoleDescription").textContent = copy.intro;
    $("hubOwnerConsoleNavLabel").textContent = copy.nav;
    renderOwnerOperationalSummary();
    renderVerificationTabs();
    renderVerificationTeamCopy();
    const teamActive = hubState.verificationWorkflow === "admin_team";
    $("verificationCenterQueuePanel").hidden = teamActive;
    $("verificationCenterTeamPanel").hidden = !teamActive;
    if(teamActive){
      renderVerificationTeam();
      return;
    }
    const workflowId = hubState.verificationWorkflow;
    const allowed = verificationWorkflowAllowed(workflowId);
    $("ownerVerificationQueueKicker").textContent = copy.queueKicker;
    $("ownerVerificationQueueTitle").textContent = verificationWorkflowLabel(workflowId, copy);
    $("ownerVerificationQueueDescription").textContent = verificationWorkflowDescription(workflowId, copy);
    $("ownerVerificationStatusLabel").textContent = copy.requestStatus;
    $("refreshOwnerVerificationQueue").textContent = copy.refresh;
    $("ownerVerificationEmptyTitle").textContent = copy.queueClear;
    $("ownerVerificationEmptyDescription").textContent = copy.noRequests;
    const role = allowed ? adminRoleLabel() : "";
    $("ownerConsoleAccessMark").textContent = role ? copy.access.replace("{role}", role) : "";
    const filter = $("ownerVerificationStatusFilter");
    const statuses = verificationStatusOptions(workflowId);
    if(filter.dataset.workflow !== workflowId){
      filter.replaceChildren();
      statuses.forEach(status => {
        const option = node("option", "", adminStatusLabel(status, copy));
        option.value = status;
        filter.append(option);
      });
      filter.dataset.workflow = workflowId;
    }
    if(!statuses.includes(hubState.adminQueueStatus)){
      hubState.adminQueueStatus = verificationDefaultStatus(workflowId);
    }
    filter.value = hubState.adminQueueStatus;
    filter.disabled = !allowed || hubState.adminQueueLoading;
    $("refreshOwnerVerificationQueue").disabled = !allowed || hubState.adminQueueLoading;
    if(hubState.adminQueueLoading){
      setStatus("ownerVerificationQueueStatus", copy.loading);
    } else if(hubState.adminQueueError){
      setStatus("ownerVerificationQueueStatus", hubState.adminQueueError, "error");
    } else if(hubState.adminQueueNotice){
      setStatus("ownerVerificationQueueStatus", hubState.adminQueueNotice, hubState.adminQueueNoticeKind);
    } else {
      setStatus("ownerVerificationQueueStatus", "");
    }
    const queue = $("ownerVerificationQueue");
    const empty = $("ownerVerificationEmpty");
    queue.replaceChildren();
    if(!allowed){
      empty.hidden = true;
      return;
    }
    empty.hidden = hubState.adminQueueLoading || Boolean(hubState.adminQueueError) || hubState.verificationCases.length > 0;
    if(hubState.adminQueueLoading || hubState.adminQueueError) return;
    hubState.verificationCases.forEach(record => {
      const card = renderVerificationCase(record);
      if(card) queue.append(card);
    });
    if(hubState.verificationCaseHasMore){
      const more = node("button", "btn-ghost hub-verification-load-more", copy.refresh);
      more.type = "button";
      more.onclick = () => void loadVerificationCenterQueue({append:true, force:true});
      queue.append(more);
    }
  }

  function verificationQueueItems(payload){
    if(Array.isArray(payload)) return payload;
    for(const key of ["items", "cases", "requests", "queue"]){
      if(Array.isArray(payload?.[key])) return payload[key];
    }
    return [];
  }

  async function loadVerificationCenterCounts({force=false}={}){
    if(!canOpenVerificationCenter() || !authClient || !currentUser) return {};
    if(hubState.verificationCountsLoading && !force) return hubState.verificationCounts;
    const context = requestContext();
    hubState.verificationCountsLoading = true;
    hubState.verificationCountsError = "";
    renderVerificationTabs();
    let response;
    try { response = await hubRpc("get_verification_center_counts"); }
    catch(error){ response = {data:null, error}; }
    if(!contextIsCurrent(context)) return {};
    hubState.verificationCountsLoading = false;
    if(response.error){
      hubState.verificationCounts = {};
      hubState.verificationCountsError = missingRpcError(response.error)
        ? ownerConsoleCopy().unavailable
        : featureError(response.error);
    } else {
      const payload = parseJsonValue(response.data, response.data) || {};
      hubState.verificationCounts = payload?.counts && typeof payload.counts === "object"
        ? payload.counts
        : (payload?.workflows && typeof payload.workflows === "object" ? payload.workflows : payload);
    }
    renderVerificationTabs();
    return hubState.verificationCounts;
  }

  async function loadVerificationCenterQueue({force=false, append=false}={}){
    const workflowId = hubState.verificationWorkflow;
    if(!verificationWorkflowAllowed(workflowId) || workflowId === "admin_team" || !authClient || !currentUser) return [];
    if(hubState.adminQueueLoading && !force) return hubState.verificationCases;
    const context = requestContext();
    const offset = append ? hubState.verificationCases.length : 0;
    hubState.adminQueueStatus = $("ownerVerificationStatusFilter")?.value || hubState.adminQueueStatus || verificationDefaultStatus(workflowId);
    hubState.adminQueueLoading = true;
    hubState.adminQueueError = "";
    hubState.adminQueueNotice = "";
    renderVerificationCenter();
    let response;
    try {
      response = await hubRpc("get_verification_center_queue", {
        p_workflow:workflowId,
        p_status:hubState.adminQueueStatus,
        p_limit:VERIFICATION_PAGE_SIZE,
        p_offset:offset
      });
    } catch(error){ response = {data:null, error}; }
    if(!contextIsCurrent(context) || hubState.verificationWorkflow !== workflowId) return [];
    hubState.adminQueueLoading = false;
    if(response.error){
      hubState.verificationCases = append ? hubState.verificationCases : [];
      hubState.adminQueueError = missingRpcError(response.error)
        ? ownerConsoleCopy().unavailable
        : featureError(response.error);
      hubState.verificationCaseHasMore = false;
    } else {
      const payload = parseJsonValue(response.data, response.data);
      const items = verificationQueueItems(payload);
      hubState.verificationCases = append ? [...hubState.verificationCases, ...items] : items;
      hubState.verificationCaseOffset = hubState.verificationCases.length;
      hubState.verificationCaseHasMore = payload?.has_more === true || items.length === VERIFICATION_PAGE_SIZE;
      hubState.adminQueue = hubState.verificationCases;
    }
    renderVerificationCenter();
    return hubState.verificationCases;
  }

  async function reviewVerificationCenterCase(record, action, reviewerNote, noteInput){
    const workflowId = hubState.verificationWorkflow;
    const caseId = verificationCaseId(record);
    if(!verificationWorkflowAllowed(workflowId) || !caseId || hubState.adminReviewBusy.has(caseId)) return;
    const copy = ownerConsoleCopy();
    const note = String(reviewerNote || "").trim();
    if(verificationActionNeedsNote(action) && !note){
      hubState.adminQueueNotice = copy.noteRequired;
      hubState.adminQueueNoticeKind = "error";
      renderVerificationCenter();
      const restored = document.querySelector(`[data-case-id="${CSS.escape(caseId)}"] .hub-admin-review-note textarea`);
      (restored || noteInput)?.focus();
      return;
    }
    const actionLabel = verificationActionLabel(action, copy);
    const confirmed = await requestHubAction({
      title:copy.actionConfirmTitle,
      message:copy.actionConfirm.replace("{action}", actionLabel),
      confirmLabel:actionLabel,
      danger:["reject", "dismiss"].includes(action)
    });
    if(!confirmed) return;
    const context = requestContext();
    hubState.adminReviewBusy.add(caseId);
    hubState.adminQueueNotice = copy.savingDecision;
    hubState.adminQueueNoticeKind = "";
    renderVerificationCenter();
    let response;
    const options = workflowId === "school_verification"
      ? {verification_method:record?.evidence_kind === "manual_review" ? "manual" : (record?.evidence_kind || "manual")}
      : {};
    try {
      response = await hubRpc("review_verification_center_case", {
        p_workflow:workflowId,
        p_case_id:caseId,
        p_action:action,
        p_note:note || null,
        p_options:options
      });
    } catch(error){ response = {error}; }
    if(!contextIsCurrent(context)) return;
    hubState.adminReviewBusy.delete(caseId);
    if(response.error){
      hubState.adminQueueNotice = missingRpcError(response.error) ? copy.unavailable : copy.decisionFailed;
      hubState.adminQueueNoticeKind = "error";
      renderVerificationCenter();
      return;
    }
    await Promise.all([
      loadVerificationCenterQueue({force:true}),
      loadVerificationCenterCounts({force:true})
    ]);
    if(!contextIsCurrent(context)) return;
    hubState.adminQueueNotice = copy.actionSaved;
    hubState.adminQueueNoticeKind = "success";
    renderVerificationCenter();
  }

  async function switchVerificationWorkflow(workflowId, {focus=false}={}){
    if(!verificationWorkflowAllowed(workflowId)) return;
    hubState.verificationWorkflow = workflowId;
    hubState.adminQueueStatus = workflowId === "admin_team" ? "all" : verificationDefaultStatus(workflowId);
    hubState.verificationCases = [];
    hubState.adminQueue = [];
    hubState.adminQueueError = "";
    hubState.adminQueueNotice = "";
    renderVerificationCenter();
    if(focus){
      document.querySelector(`[data-verification-workflow="${CSS.escape(workflowId)}"]`)?.focus();
    }
    if(workflowId === "admin_team") await loadVerificationAdminTeam({force:true});
    else await loadVerificationCenterQueue({force:true});
  }

  function verificationSelectedScopes(container){
    return [...container.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
  }

  async function loadVerificationAdminTeam({force=false}={}){
    if(!hasAdminCapability("team.manage") || !authClient || !currentUser) return [];
    if(hubState.verificationTeamLoading && !force) return hubState.verificationTeam;
    const context = requestContext();
    hubState.verificationTeamLoading = true;
    hubState.verificationTeamError = "";
    renderVerificationTeam();
    let response;
    try { response = await hubRpc("get_concourse_admin_team"); }
    catch(error){ response = {data:null, error}; }
    if(!contextIsCurrent(context)) return [];
    hubState.verificationTeamLoading = false;
    if(response.error){
      hubState.verificationTeam = [];
      hubState.verificationTeamError = missingRpcError(response.error)
        ? ownerConsoleCopy().unavailable
        : featureError(response.error);
    } else {
      const payload = parseJsonValue(response.data, response.data);
      hubState.verificationTeam = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.items)
          ? payload.items
          : (Array.isArray(payload?.members) ? payload.members : (Array.isArray(payload?.admins) ? payload.admins : [])));
    }
    renderVerificationTeam();
    return hubState.verificationTeam;
  }

  async function appointVerificationAdmin(){
    if(!hasAdminCapability("team.manage") || hubState.verificationTeamLoading) return;
    const copy = ownerConsoleCopy();
    const identifier = $("verificationTeamIdentifier").value.trim();
    const role = $("verificationTeamRole").value;
    const scopes = verificationSelectedScopes($("verificationTeamScopePicker"));
    if(!identifier){
      setStatus("verificationTeamStatus", copy.teamIdentifierRequired, "error");
      $("verificationTeamIdentifier").focus();
      return;
    }
    if(!scopes.length){
      setStatus("verificationTeamStatus", copy.teamScopeRequired, "error");
      $("verificationTeamScopePicker").querySelector("input")?.focus();
      return;
    }
    const context = requestContext();
    hubState.verificationTeamLoading = true;
    renderVerificationTeam();
    let response;
    try {
      response = await hubRpc("appoint_concourse_admin", {
        p_identifier:identifier,
        p_role:role,
        p_scopes:scopes
      });
    } catch(error){ response = {error}; }
    if(!contextIsCurrent(context)) return;
    hubState.verificationTeamLoading = false;
    if(response.error){
      setStatus("verificationTeamStatus", missingRpcError(response.error) ? copy.teamUnavailable : featureError(response.error), "error");
      renderVerificationTeam();
      return;
    }
    $("verificationTeamIdentifier").value = "";
    $("verificationTeamScopePicker").querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; });
    await loadVerificationAdminTeam({force:true});
    if(contextIsCurrent(context)) setStatus("verificationTeamStatus", copy.teamAppointed, "success");
  }

  async function updateVerificationAdmin(member, role, scopes){
    const userId = verificationSafeValue(member?.user_id || member?.id);
    if(!hasAdminCapability("team.manage") || !userId || hubState.verificationTeamBusy.has(userId)) return;
    const copy = ownerConsoleCopy();
    if(!scopes.length){
      setStatus("verificationTeamStatus", copy.teamScopeRequired, "error");
      return;
    }
    const context = requestContext();
    hubState.verificationTeamBusy.add(userId);
    renderVerificationTeam();
    let response;
    try {
      response = await hubRpc("update_concourse_admin_scopes", {
        p_user_id:userId,
        p_role:role,
        p_scopes:scopes
      });
    } catch(error){ response = {error}; }
    if(!contextIsCurrent(context)) return;
    hubState.verificationTeamBusy.delete(userId);
    if(response.error){
      setStatus("verificationTeamStatus", missingRpcError(response.error) ? copy.teamUnavailable : featureError(response.error), "error");
      renderVerificationTeam();
      return;
    }
    await loadVerificationAdminTeam({force:true});
    if(contextIsCurrent(context)) setStatus("verificationTeamStatus", copy.teamUpdated, "success");
  }

  async function revokeVerificationAdmin(member){
    const userId = verificationSafeValue(member?.user_id || member?.id);
    if(!hasAdminCapability("team.manage") || !userId || hubState.verificationTeamBusy.has(userId)) return;
    const copy = ownerConsoleCopy();
    const confirmed = await requestHubAction({
      title:copy.teamRevoke,
      message:copy.revokeConfirm,
      confirmLabel:copy.teamRevoke,
      danger:true
    });
    if(!confirmed) return;
    const context = requestContext();
    hubState.verificationTeamBusy.add(userId);
    renderVerificationTeam();
    let response;
    try { response = await hubRpc("revoke_concourse_admin", {p_user_id:userId}); }
    catch(error){ response = {error}; }
    if(!contextIsCurrent(context)) return;
    hubState.verificationTeamBusy.delete(userId);
    if(response.error){
      setStatus("verificationTeamStatus", missingRpcError(response.error) ? copy.teamUnavailable : featureError(response.error), "error");
      renderVerificationTeam();
      return;
    }
    await loadVerificationAdminTeam({force:true});
    if(contextIsCurrent(context)) setStatus("verificationTeamStatus", copy.teamRevoked, "success");
  }

  async function syncFinalSchedule(snapshot=finalTimetable){
    if(!authClient || !currentUser || !snapshot?.savedAt) return false;
    const context = requestContext();
    const { error } = await authClient.rpc("sync_final_schedule", {p_snapshot:snapshot});
    if(!contextIsCurrent(context)) return false;
    if(error){
      console.warn("The final timetable is safe in private planner state, but the anonymous insights index could not be updated:", error);
      return false;
    }
    return true;
  }

  function insightEmpty(title, description, {offerExample=false}={}){
    const container = $("courseInsightChart");
    container.replaceChildren();
    const empty = node("div", `hub-chart-empty${offerExample ? " hub-chart-empty--interactive" : ""}`);
    if(!offerExample){
      empty.append(node("b", "", title), node("span", "", description));
      container.append(empty);
      return;
    }
    const mark = node("div", "hub-insight-example-mark");
    mark.setAttribute("aria-hidden", "true");
    [74, 56, 38].forEach(value => {
      const bar = node("span");
      bar.style.setProperty("--insight-example-value", `${value}%`);
      mark.append(bar);
    });
    const copy = node("div", "hub-insight-example-copy");
    copy.append(
      node("span", "", t("insightExampleEyebrow")),
      node("b", "", t("insightExampleTitle")),
      node("p", "", t("insightExampleDescription"))
    );
    const button = node("button", "hub-insight-example-button", t("insightPreviewExample"));
    button.type = "button";
    button.dataset.insightExampleAction = "preview";
    copy.append(button);
    empty.append(mark, copy);
    container.append(empty);
  }

  function appendInsightExampleHead(container, mode){
    const head = node("div", "hub-insight-example-head");
    const copy = node("div", "hub-insight-example-head-copy");
    const title = node("b", "", t("insightExampleFictional"));
    title.id = "insightDemoHeading";
    title.setAttribute("role", "heading");
    title.setAttribute("aria-level", "2");
    copy.append(
      node("span", "", t("insightExampleEyebrow")),
      title,
      node("p", "", t("insightExampleDescription"))
    );
    const tabs = node("div", "hub-insight-example-tabs");
    [
      ["major", t("insightExampleSameMajor")],
      ["university", t("insightExampleUniversity")],
      ["close", t("insightExampleExit")]
    ].forEach(([action, label]) => {
      const button = node("button", action === mode ? "active" : "", label);
      button.type = "button";
      button.dataset.insightExampleAction = action;
      if(action !== "close") button.setAttribute("aria-pressed", action === mode ? "true" : "false");
      tabs.append(button);
    });
    copy.append(tabs);
    head.append(copy);
    container.append(head);
  }

  function insightPercent(value){
    return Math.max(0, Math.min(100, Number(value || 0)));
  }

  function insightProgress(label, value, className="hub-insight-demo-progress"){
    const share = insightPercent(value);
    const track = node("div", className);
    const fill = node("span", `${className}-fill`);
    fill.style.setProperty("--insight-progress", `${share}%`);
    fill.style.width = `${share}%`;
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", `${label}: ${share}%`);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(share));
    track.append(fill);
    return track;
  }

  function appendInsightDemoSummary(container, summary){
    const list = node("div", "hub-insight-demo-summary");
    list.setAttribute("role", "list");
    [
      [t("insightCohortSize"), summary.cohortSize],
      [t("insightMedianCredits"), summary.medianCredits],
      [t("insightSectionCount"), summary.sectionCount],
      [t("insightProfessorCount"), summary.professorCount]
    ].forEach(([label, value]) => {
      const item = node("div", "hub-insight-demo-kpi");
      item.setAttribute("role", "listitem");
      item.append(node("b", "", value), node("span", "", label));
      list.append(item);
    });
    container.append(list);
  }

  function appendInsightCourseDemand(container, courses){
    const section = document.createElement("section");
    section.className = "hub-insight-demo-section hub-insight-demo-courses";
    section.setAttribute("aria-labelledby", "insightDemoCourseHeading");
    const heading = node("h3", "", t("insightCourseDemand"));
    heading.id = "insightDemoCourseHeading";
    const list = node("div", "hub-insight-demo-bar-list");
    list.setAttribute("role", "list");
    courses.forEach(course => {
      const share = insightPercent(course.share_percent);
      const row = node("div", "hub-insight-demo-bar-row");
      row.setAttribute("role", "listitem");
      const label = node("div", "hub-insight-demo-bar-label");
      label.append(
        node("b", "", course.course_name),
        node("span", "", `${course.course_code} · ${t("courseChosenBy", {count:course.selection_count})}`)
      );
      row.append(label, insightProgress(course.course_name, share), node("strong", "", `${share}%`));
      list.append(row);
    });
    section.append(heading, list);
    container.append(section);
  }

  function appendInsightSectionDemand(container, sections){
    const section = document.createElement("section");
    section.className = "hub-insight-demo-section hub-insight-demo-sections";
    section.setAttribute("aria-labelledby", "insightDemoSectionHeading");
    const heading = node("h3", "", t("insightSectionDemand"));
    heading.id = "insightDemoSectionHeading";
    const tableWrap = node("div", "hub-insight-demo-table-wrap");
    const table = document.createElement("table");
    table.className = "hub-insight-demo-table";
    table.setAttribute("aria-label", t("insightSectionDemand"));
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    [t("insightSection"), t("insightProfessor"), t("insightSchedule"), t("insightDemand")].forEach(label => {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      headRow.append(cell);
    });
    thead.append(headRow);
    const tbody = document.createElement("tbody");
    sections.forEach(item => {
      const row = document.createElement("tr");
      const sectionCell = document.createElement("th");
      sectionCell.scope = "row";
      sectionCell.textContent = item.section;
      const professorCell = node("td", "", item.professor);
      const scheduleCell = node("td", "", item.schedule);
      const demandCell = node("td", "hub-insight-demo-demand");
      demandCell.append(
        insightProgress(`${item.section} ${t("insightDemand")}`, item.demand_percent, "hub-insight-demo-demand-track"),
        node("span", "", `${insightPercent(item.demand_percent)}%`)
      );
      row.append(sectionCell, professorCell, scheduleCell, demandCell);
      tbody.append(row);
    });
    table.append(thead, tbody);
    tableWrap.append(table);
    section.append(heading, tableWrap);
    container.append(section);
  }

  function appendInsightProfessorPatterns(container, professors){
    const section = document.createElement("section");
    section.className = "hub-insight-demo-section hub-insight-demo-professors";
    section.setAttribute("aria-labelledby", "insightDemoProfessorHeading");
    const heading = node("h3", "", t("insightProfessorPatterns"));
    heading.id = "insightDemoProfessorHeading";
    const list = node("div", "hub-insight-demo-professor-list");
    list.setAttribute("role", "list");
    professors.forEach(item => {
      const entry = node("article", "hub-insight-demo-professor");
      entry.setAttribute("role", "listitem");
      const copy = node("div", "hub-insight-demo-professor-copy");
      copy.append(
        node("b", "", item.name),
        node("span", "", `${item.course_codes} · ${item.section_count} ${t("insightSectionsShort")}`)
      );
      entry.append(
        copy,
        insightProgress(item.name, item.share_percent, "hub-insight-demo-professor-track"),
        node("strong", "", t("insightStudentsCount", {count:item.selection_count}))
      );
      list.append(entry);
    });
    section.append(heading, list);
    container.append(section);
  }

  function appendInsightDistribution(container, {headingId, headingKey, items, className}){
    const section = document.createElement("section");
    section.className = `hub-insight-demo-section ${className}`;
    section.setAttribute("aria-labelledby", headingId);
    const heading = node("h3", "", t(headingKey));
    heading.id = headingId;
    const list = node("div", "hub-insight-demo-distribution");
    list.setAttribute("role", "list");
    items.forEach(item => {
      const label = item.labelKey ? t(item.labelKey) : item.label;
      const entry = node("div", "hub-insight-demo-distribution-item");
      entry.setAttribute("role", "listitem");
      const column = node("div", "hub-insight-demo-distribution-column");
      const fill = node("span", "hub-insight-demo-distribution-fill");
      fill.style.setProperty("--insight-distribution", `${insightPercent(item.share_percent)}%`);
      fill.style.height = `${insightPercent(item.share_percent)}%`;
      column.setAttribute("role", "img");
      column.setAttribute("aria-label", `${label}: ${insightPercent(item.share_percent)}%`);
      column.append(fill);
      entry.append(
        node("b", "", `${insightPercent(item.share_percent)}%`),
        column,
        node("span", "", label)
      );
      list.append(entry);
    });
    section.append(heading, list);
    container.append(section);
  }

  function appendInsightTimetablePatterns(container, patterns){
    const section = document.createElement("section");
    section.className = "hub-insight-demo-section hub-insight-demo-timetable";
    section.setAttribute("aria-labelledby", "insightDemoTimetableHeading");
    const heading = node("h3", "", t("insightTimetablePatterns"));
    heading.id = "insightDemoTimetableHeading";
    const groups = node("div", "hub-insight-demo-pattern-groups");
    [
      [t("insightClassTime"), patterns.time],
      [t("insightCampusDays"), patterns.days]
    ].forEach(([label, items]) => {
      const group = node("div", "hub-insight-demo-pattern-group");
      group.append(node("h4", "", label));
      items.forEach(item => {
        const itemLabel = t(item.labelKey);
        const row = node("div", "hub-insight-demo-pattern-row");
        row.append(
          node("span", "", itemLabel),
          insightProgress(itemLabel, item.share_percent, "hub-insight-demo-pattern-track"),
          node("strong", "", `${insightPercent(item.share_percent)}%`)
        );
        group.append(row);
      });
      groups.append(group);
    });
    section.append(heading, groups);
    container.append(section);
  }

  function renderInsightDemo(model, mode){
    const container = $("courseInsightChart");
    container.replaceChildren();
    appendInsightExampleHead(container, mode);
    const dashboard = node("section", "hub-insight-demo-dashboard");
    dashboard.dataset.insightExample = mode;
    dashboard.setAttribute("aria-labelledby", "insightDemoHeading");
    appendInsightDemoSummary(dashboard, model.summary);
    const primary = node("div", "hub-insight-demo-primary");
    appendInsightCourseDemand(primary, model.courses);
    appendInsightSectionDemand(primary, model.sections);
    const secondary = node("div", "hub-insight-demo-secondary");
    appendInsightProfessorPatterns(secondary, model.professors);
    appendInsightDistribution(secondary, {
      headingId:"insightDemoCreditHeading",
      headingKey:"insightCreditDistribution",
      items:model.creditDistribution,
      className:"hub-insight-demo-credits"
    });
    appendInsightTimetablePatterns(secondary, model.timetablePatterns);
    dashboard.append(primary, secondary);
    container.append(dashboard);
    setStatus("courseInsightStatus", t("insightExampleStatus"));
  }

  function formatInsightMeetingTimes(value){
    const slots = parseJsonValue(value, []);
    if(!Array.isArray(slots) || !slots.length) return "—";
    return slots.map(slot => {
      if(typeof slot === "string") return slot.trim();
      const days = Array.isArray(slot?.days)
        ? slot.days.filter(Boolean).join(" / ")
        : String(slot?.day || slot?.weekday || "").trim();
      const start = String(slot?.start || slot?.start_time || "").trim();
      const end = String(slot?.end || slot?.end_time || "").trim();
      return [
        days,
        start && end ? `${start}–${end}` : start || end
      ].filter(Boolean).join(" · ");
    }).filter(Boolean).join("; ") || "—";
  }

  function insightLiveModel(rows, dimensions){
    const safeRows = Array.isArray(rows) ? rows : [];
    const safeDimensions = Array.isArray(dimensions) ? dimensions : [];
    const courses = safeDimensions
      .filter(item => item.dimension_type === "course")
      .map(item => ({
        course_key:item.course_key || item.dimension_key,
        course_code:item.secondary_label || "",
        course_name:item.primary_label || item.secondary_label || item.dimension_key,
        selection_count:Number(item.selection_count || 0),
        share_percent:insightPercent(item.share_percent)
      }));
    const effectiveCourses = courses.length ? courses : safeRows.map(item => ({
      course_key:item.course_key,
      course_code:item.course_code || "",
      course_name:item.course_name || item.course_code || item.course_key,
      selection_count:Number(item.selection_count || 0),
      share_percent:insightPercent(item.share_percent)
    }));
    const sections = safeDimensions
      .filter(item => item.dimension_type === "section")
      .map(item => {
        const secondary = String(item.secondary_label || "").split(" · ").filter(Boolean);
        return {
          section:item.primary_label || item.dimension_key,
          professor:secondary.length > 1 ? secondary.at(-1) : "—",
          schedule:formatInsightMeetingTimes(item.meeting_times),
          selection_count:Number(item.selection_count || 0),
          demand_percent:insightPercent(item.share_percent)
        };
      });
    const professors = safeDimensions
      .filter(item => item.dimension_type === "professor")
      .map(item => ({
        name:item.primary_label || item.dimension_key,
        course_codes:item.secondary_label || "—",
        section_count:Math.max(
          1,
          sections.filter(section => section.professor === item.primary_label).length
        ),
        selection_count:Number(item.selection_count || 0),
        share_percent:insightPercent(item.share_percent)
      }));
    const allRows = [...safeRows, ...safeDimensions];
    return {
      summary:{
        cohortSize:Math.max(0, ...allRows.map(item => Number(item.cohort_size || 0))),
        courses:effectiveCourses.length,
        sections:sections.length,
        professors:professors.length
      },
      courses:effectiveCourses,
      sections,
      professors
    };
  }

  function appendInsightLiveSummary(container, summary){
    const labels = communitySeedText({
      en:["Student Cohort", "Courses Tracked", "Sections Tracked", "Professors Tracked"],
      "zh-CN":["学生群体", "课程数量", "班别数量", "教师数量"],
      "zh-HK":["學生群組", "科目數量", "課堂組別", "教師人數"]
    });
    const values = [summary.cohortSize, summary.courses, summary.sections, summary.professors];
    const list = node("div", "hub-insight-demo-summary hub-insight-live-summary");
    list.setAttribute("role", "list");
    values.forEach((value, index) => {
      const item = node("div", "hub-insight-demo-kpi");
      item.setAttribute("role", "listitem");
      item.append(node("b", "", value), node("span", "", labels[index]));
      list.append(item);
    });
    container.append(list);
  }

  function renderInsightLiveDashboard(rows, dimensions){
    const container = $("courseInsightChart");
    const model = insightLiveModel(rows, dimensions);
    container.replaceChildren();
    const dashboard = node("section", "hub-insight-demo-dashboard hub-insight-live-dashboard");
    dashboard.dataset.insightSource = "live";
    appendInsightLiveSummary(dashboard, model.summary);
    const primary = node("div", "hub-insight-demo-primary");
    appendInsightCourseDemand(primary, model.courses);
    if(model.sections.length) appendInsightSectionDemand(primary, model.sections);
    const secondary = node("div", "hub-insight-demo-secondary");
    if(model.professors.length) appendInsightProfessorPatterns(secondary, model.professors);
    dashboard.append(primary);
    if(secondary.childElementCount) dashboard.append(secondary);
    container.append(dashboard);
  }

  function renderInsights(rows, {exampleMode="", dimensions=hubState.insightDimensions}={}){
    const persistentPreview = $("previewCourseInsights");
    if(persistentPreview) persistentPreview.hidden = Boolean(exampleMode) || !Array.isArray(rows) || !rows.length;
    if(exampleMode){
      const model = INSIGHT_DEMO[exampleMode];
      if(model) renderInsightDemo(model, exampleMode);
      return;
    }
    const container = $("courseInsightChart");
    container.replaceChildren();
    if(!Array.isArray(rows) || !rows.length){
      insightEmpty(t("courseInsightNoData"), t("courseInsightPrivacy", {minimum:"5"}), {offerExample:true});
      return;
    }
    if(Array.isArray(dimensions) && dimensions.length){
      renderInsightLiveDashboard(rows, dimensions);
      setStatus(
        "courseInsightStatus",
        t("courseChoiceParticipants", {count:rows[0].cohort_size || dimensions[0]?.cohort_size || 0})
      );
      return;
    }
    rows.forEach(row => {
      const share = Math.max(0, Math.min(100, Number(row.share_percent || 0)));
      const chartRow = node("div", "hub-chart-row");
      const label = node("div", "hub-chart-label");
      label.append(node("b", "", row.course_name || row.course_code || row.course_key), node("span", "", row.course_code || t("courseChosenBy", {count:row.selection_count})));
      const track = node("div", "hub-chart-track");
      const fill = node("div", "hub-chart-fill");
      fill.style.width = `${share}%`;
      fill.title = t("courseChosenBy", {count:row.selection_count});
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", `${row.course_name || row.course_code || row.course_key}: ${share}%`);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(share));
      track.append(fill);
      chartRow.append(label, track, node("div", "hub-chart-value", `${share}%`));
      container.append(chartRow);
    });
    setStatus(
      "courseInsightStatus",
      t("courseChoiceParticipants", {count:rows[0].cohort_size || 0})
    );
  }

  function renderInsightExample(mode="major"){
    const nextMode = INSIGHT_DEMO[mode] ? mode : "major";
    hubState.insightDemoMode = nextMode;
    renderInsights([], {exampleMode:nextMode});
  }

  async function loadCourseInsights(){
    if(!authClient || !currentUser) return;
    hubState.insightDemoMode = "";
    const context = requestContext();
    setStatus("courseInsightStatus", t("courseInsightLoading"));
    $("loadCourseInsights").disabled = true;
    $("previewCourseInsights").hidden = true;
    insightEmpty(t("loading"), t("courseInsightLoading"));
    const yearValue = $("courseInsightYear").value;
    const scope = $("courseInsightScope").value;
    const parameters = {
      p_scope:scope,
      p_study_year:["same_major_year", "university_year"].includes(scope) && yearValue ? Number(yearValue) : null
    };
    let statsResponse;
    let dimensionsResponse;
    try {
      [statsResponse, dimensionsResponse] = await Promise.all([
        hubRpc("get_course_choice_stats", parameters),
        hubRpc("get_course_choice_dimensions", {...parameters, p_course_key:null})
      ]);
    } catch(requestError){
      statsResponse = {data:null, error:requestError};
      dimensionsResponse = {data:null, error:requestError};
    }
    if(!contextIsCurrent(context)) return;
    $("loadCourseInsights").disabled = false;
    if(statsResponse.error){
      insightEmpty(t("courseInsightUnavailable"), featureError(statsResponse.error));
      setStatus("courseInsightStatus", featureError(statsResponse.error), "error");
      return;
    }
    hubState.insightRows = Array.isArray(statsResponse.data) ? statsResponse.data : [];
    hubState.insightDimensions = dimensionsResponse.error || !Array.isArray(dimensionsResponse.data)
      ? []
      : dimensionsResponse.data;
    hubState.insightsLoaded = true;
    renderInsights(hubState.insightRows, {dimensions:hubState.insightDimensions});
    if(dimensionsResponse.error && hubState.insightRows.length){
      setStatus(
        "courseInsightStatus",
        communitySeedText({
          en:"Course totals are available. Section and professor detail could not be loaded.",
          "zh-CN":"课程总览可用，但班别与教师详情暂时无法加载。",
          "zh-HK":"科目總覽可用，但課堂組別同教師詳情暫時未能載入。"
        }),
        "error"
      );
    }
  }

  const parseInterests = value => [...new Set(String(value || "").split(",").map(item => item.trim().slice(0, 45)).filter(Boolean))].slice(0, 20);
  function validatedUrl(value, provider){
    const input = String(value || "").trim();
    if(!input) return null;
    let url;
    try { url = new URL(input); } catch(_error){ throw new Error(t("invalidUrl")); }
    if(url.protocol !== "https:") throw new Error(t("invalidUrl"));
    const host = url.hostname.toLocaleLowerCase();
    const allowed = {
      instagram: host === "instagram.com" || host.endsWith(".instagram.com"),
      whatsapp: host === "wa.me" || host === "api.whatsapp.com",
      linkedin: host === "linkedin.com" || host.endsWith(".linkedin.com"),
      website: true
    };
    if(!allowed[provider]) throw new Error(t(`invalid${provider[0].toLocaleUpperCase()}${provider.slice(1)}Url`));
    return url.toString();
  }

  function validatedWechatId(value){
    const input = String(value || "").trim();
    if(!input) return null;
    if(input.length > 64 || /[\u0000-\u001f\u007f]/.test(input)) throw new Error(t("invalidWechatId"));
    return input;
  }

  function renderSocialConnections(){
    Object.values(SOCIAL_PROVIDERS).forEach(config => {
      const card = document.querySelector(`[data-social-provider="${config.provider}"]`);
      if(!card) return;
      const identity = hubState.socialIdentities.get(config.provider) || null;
      const connected = !!identity;
      const loading = hubState.socialConnectionLoading
        && (!hubState.socialConnectionProvider || hubState.socialConnectionProvider === config.provider);
      const state = card.querySelector("[data-provider-state]");
      const detail = card.querySelector("[data-provider-detail]");
      const connectButton = card.querySelector('[data-social-action="connect"]');
      const disconnectButton = card.querySelector('[data-social-action="disconnect"]');
      card.classList.toggle("connected", connected);
      card.setAttribute("aria-busy", loading ? "true" : "false");
      if(state){
        state.textContent = loading
          ? t("providerConnectionLoading", {provider:config.label})
          : t(connected ? "providerConnected" : "providerNotConnected", {provider:config.label});
      }
      const connectedAt = identity?.created_at || identity?.updated_at;
      if(detail){
        detail.textContent = connected
          ? (connectedAt
              ? t("providerConnectedDetail", {provider:config.label, date:formatDate(connectedAt)})
              : t("providerConnectedHelp", {provider:config.label}))
          : t("providerConnectionHelp", {provider:config.label});
      }
      if(connectButton){
        connectButton.textContent = t("connectProvider", {provider:config.label});
        connectButton.hidden = connected;
        connectButton.disabled = hubState.socialConnectionLoading || !currentUser;
      }
      if(disconnectButton){
        disconnectButton.textContent = t("disconnect");
        disconnectButton.hidden = !connected;
        disconnectButton.disabled = hubState.socialConnectionLoading || !currentUser;
      }
    });
    renderSocialConnectionStatus();
  }

  function clearSocialReturnIntent(expected=null){
    try {
      if(expected){
        const current = JSON.parse(sessionStorage.getItem(SOCIAL_RETURN_KEY) || "null");
        if(
          current?.userId !== expected.userId
          || current?.request !== expected.request
          || (expected.provider && current?.provider !== expected.provider)
        ) return false;
      }
      sessionStorage.removeItem(SOCIAL_RETURN_KEY);
      return true;
    } catch(_error){
      if(!expected){
        try { sessionStorage.removeItem(SOCIAL_RETURN_KEY); } catch(_nestedError){}
      }
      return false;
    }
  }

  function readSocialReturnIntent(){
    try {
      const raw = sessionStorage.getItem(SOCIAL_RETURN_KEY);
      if(!raw) return null;
      const intent = JSON.parse(raw);
      const age = Date.now() - Number(intent?.createdAt || 0);
      if(!SOCIAL_PROVIDERS[intent?.provider] || age < 0 || age > 20 * 60 * 1000){
        clearSocialReturnIntent();
        return null;
      }
      return intent;
    } catch(_error){
      clearSocialReturnIntent();
      return null;
    }
  }

  function finishSocialConnectionReturn(){
    if(hubState.socialReturnHandled || !currentUser) return;
    const intent = readSocialReturnIntent();
    if(!intent) return;
    if(intent.userId !== currentUser.id){
      clearSocialReturnIntent();
      return;
    }
    hubState.socialReturnHandled = true;
    clearSocialReturnIntent();
    const config = SOCIAL_PROVIDERS[intent.provider];
    const connected = hubState.socialIdentities.has(intent.provider);
    setSocialConnectionStatus(
      connected ? "providerConnectedSuccess" : "providerConnectionFailed",
      {provider:config.label},
      connected ? "success" : "error"
    );
    if(hubAccessAllowed() && ($("memberHub").hidden || hubState.activeView !== "profile")){
      window.setTimeout(() => showHub("profile"), 0);
    }
  }

  async function loadSocialConnections({force=false}={}){
    if(!authClient || !currentUser){
      renderSocialConnections();
      return hubState.socialIdentities;
    }
    const context = requestContext();
    if(hubState.socialConnectionLoading) return hubState.socialIdentities;
    if(!force && hubState.socialConnectionUserId === context.userId){
      renderSocialConnections();
      finishSocialConnectionReturn();
      return hubState.socialIdentities;
    }
    const request = ++hubState.socialConnectionRequest;
    hubState.socialConnectionLoading = true;
    hubState.socialConnectionProvider = null;
    renderSocialConnections();
    setSocialConnectionStatus("socialConnectionsLoading");
    let response;
    try {
      response = await authClient.auth.getUserIdentities();
    } catch(error){
      response = {data:null, error};
    }
    if(!contextIsCurrent(context) || request !== hubState.socialConnectionRequest) return null;
    hubState.socialConnectionLoading = false;
    hubState.socialConnectionProvider = null;
    if(response.error){
      hubState.socialConnectionUserId = null;
      renderSocialConnections();
      const intent = readSocialReturnIntent();
      if(intent){
        hubState.socialReturnHandled = true;
        clearSocialReturnIntent();
      }
      const errorStatus = intent
        ? socialConnectionError(response.error, intent.provider)
        : {key:"socialConnectionsUnavailable", variables:{}};
      setSocialConnectionStatus(errorStatus.key, errorStatus.variables, "error");
      return hubState.socialIdentities;
    }
    const identities = Array.isArray(response.data?.identities) ? response.data.identities : [];
    const allowedIdentities = identities
      .filter(identity => !!SOCIAL_PROVIDERS[identity?.provider])
      .sort((left, right) => {
        const rightTime = new Date(right?.updated_at || right?.created_at || 0).getTime() || 0;
        const leftTime = new Date(left?.updated_at || left?.created_at || 0).getTime() || 0;
        return rightTime - leftTime;
      });
    hubState.socialIdentities = new Map();
    allowedIdentities.forEach(identity => {
      if(!hubState.socialIdentities.has(identity.provider)) hubState.socialIdentities.set(identity.provider, identity);
    });
    hubState.socialConnectionUserId = context.userId;
    renderSocialConnections();
    setSocialConnectionStatus();
    renderOverview();
    finishSocialConnectionReturn();
    return hubState.socialIdentities;
  }

  async function connectSocialProvider(provider){
    const config = SOCIAL_PROVIDERS[provider];
    if(!config) return;
    if(!authClient || !currentUser){
      setSocialConnectionStatus("providerConnectionFailed", {provider:config.label}, "error");
      return;
    }
    if(hubState.socialConnectionLoading || hubState.socialIdentities.has(provider)) return;
    if(typeof authClient.auth?.linkIdentity !== "function"){
      setSocialConnectionStatus("providerSetupRequired", {provider:config.label}, "error");
      return;
    }
    const context = requestContext();
    if(hubState.profileDirty && !(await saveMemberProfile())){
      if(!contextIsCurrent(context)) return;
      setSocialConnectionStatus("providerConnectionFailed", {provider:config.label}, "error");
      return;
    }
    if(!contextIsCurrent(context)) return;
    const request = ++hubState.socialConnectionRequest;
    hubState.socialConnectionLoading = true;
    hubState.socialConnectionProvider = provider;
    renderSocialConnections();
    setSocialConnectionStatus("providerConnecting", {provider:config.label});
    try {
      sessionStorage.setItem(SOCIAL_RETURN_KEY, JSON.stringify({
        provider,
        userId: context.userId,
        request,
        createdAt: Date.now()
      }));
    } catch(_error){}
    let response;
    try {
      response = await authClient.auth.linkIdentity({
        provider,
        options: {redirectTo:SOCIAL_OAUTH_RETURN_URL}
      });
    } catch(error){
      response = {error};
    }
    if(!contextIsCurrent(context) || request !== hubState.socialConnectionRequest) return;
    if(response?.error){
      clearSocialReturnIntent({provider, userId:context.userId, request});
      hubState.socialConnectionLoading = false;
      hubState.socialConnectionProvider = null;
      renderSocialConnections();
      const errorStatus = socialConnectionError(response.error, provider);
      setSocialConnectionStatus(errorStatus.key, errorStatus.variables, "error");
      return;
    }
    const oauthUrl = response?.data?.url;
    if(oauthUrl){
      window.location.assign(oauthUrl);
      return;
    }
    clearSocialReturnIntent({provider, userId:context.userId, request});
    hubState.socialConnectionLoading = false;
    hubState.socialConnectionProvider = null;
    renderSocialConnections();
    setSocialConnectionStatus("providerConnectionFailed", {provider:config.label}, "error");
  }

  function handleUnexpectedSocialActionError(provider, action, error){
    const config = SOCIAL_PROVIDERS[provider];
    hubState.socialConnectionLoading = false;
    hubState.socialConnectionProvider = null;
    if(action === "connect") clearSocialReturnIntent();
    renderSocialConnections();
    if(action === "disconnect"){
      setSocialConnectionStatus("providerDisconnectFailed", {provider:config?.label || t("socialAccount")}, "error");
    } else {
      const status = socialConnectionError(error, provider);
      setSocialConnectionStatus(status.key, status.variables, "error");
    }
    console.error(`Unexpected ${action} account error:`, error);
  }

  async function disconnectSocialProvider(provider){
    const config = SOCIAL_PROVIDERS[provider];
    const identity = hubState.socialIdentities.get(provider);
    if(!config || !authClient || !currentUser || !identity || hubState.socialConnectionLoading) return;
    const confirmed = await requestHubAction({
      title:t("disconnectProviderTitle", {provider:config.label}),
      message:t("confirmDisconnectProvider", {provider:config.label}),
      confirmLabel:t("disconnect"),
      danger:true
    });
    if(!confirmed) return;
    const context = requestContext();
    hubState.socialConnectionLoading = true;
    hubState.socialConnectionProvider = provider;
    renderSocialConnections();
    let response;
    try {
      response = await authClient.auth.unlinkIdentity(identity);
    } catch(error){
      response = {error};
    }
    if(!contextIsCurrent(context)) return;
    hubState.socialConnectionLoading = false;
    hubState.socialConnectionProvider = null;
    if(response.error){
      renderSocialConnections();
      setSocialConnectionStatus("providerDisconnectFailed", {provider:config.label}, "error");
      return;
    }
    hubState.socialIdentities.delete(provider);
    hubState.socialConnectionUserId = null;
    await loadSocialConnections({force:true});
    if(!contextIsCurrent(context)) return;
    setSocialConnectionStatus("providerDisconnected", {provider:config.label}, "success");
  }

  function fillMemberProfile(profile={}){
    $("profileDisplayName").value = profile.display_name || "";
    $("profilePhone").value = profile.phone_number || "";
    $("profileBio").value = profile.bio || "";
    $("profileInterests").value = Array.isArray(profile.interests) ? profile.interests.join(", ") : "";
    $("profileInstagram").value = profile.instagram_url || "";
    $("profileWhatsapp").value = profile.whatsapp_url || "";
    $("profileLinkedin").value = profile.linkedin_url || "";
    $("profileWechat").value = profile.wechat_id || "";
    $("profileShareWechat").checked = profile.share_wechat === true;
    $("profileWebsite").value = profile.website_url || "";
    $("profileVisibility").value = profile.profile_visibility === "private" ? "private" : "school";
    $("profileAllowMessages").checked = profile.allow_messages === true;
    $("profileAnalyticsConsent").checked = profile.analytics_consent === true;
    renderOwnAvatars();
    renderMessageAvailability();
  }

  function switchConnectionTab(tab){
    const activeTab = tab === "links" ? "links" : "verified";
    document.querySelectorAll("[data-connection-tab]").forEach(button => {
      const active = button.dataset.connectionTab === activeTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });
    $("verifiedConnectionsPanel").hidden = activeTab !== "verified";
    $("profileLinksPanel").hidden = activeTab !== "links";
  }

  function handleConnectionTabKeydown(event){
    if(!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...document.querySelectorAll("[data-connection-tab]")];
    if(!tabs.length) return;
    event.preventDefault();
    const currentIndex = Math.max(0, tabs.indexOf(event.currentTarget));
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    switchConnectionTab(tabs[nextIndex].dataset.connectionTab);
    tabs[nextIndex].focus();
  }

  function setProfileFormDisabled(disabled){
    document.querySelectorAll('[data-hub-view="profile"] input, [data-hub-view="profile"] textarea, [data-hub-view="profile"] select')
      .forEach(control => { control.disabled = disabled; });
    $("saveMemberProfile").disabled = disabled || hubState.profileLoading || hubState.avatarBusy;
    $("chooseProfileAvatar").disabled = disabled || hubState.avatarBusy;
    if(disabled || hubState.avatarBusy) $("removeProfileAvatar").disabled = true;
    else renderOwnAvatars();
  }

  async function isSvgUpload(file){
    const mime = String(file?.type || "").toLocaleLowerCase();
    const name = String(file?.name || "").toLocaleLowerCase();
    if(["image/svg+xml", "image/svg", "application/svg+xml"].includes(mime) || /\.svgz?$/.test(name)) return true;
    const header = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    if(header[0] === 0x1f && header[1] === 0x8b) return true;
    const utf8 = new TextDecoder("utf-8", {fatal:false}).decode(header).replace(/^\uFEFF/, "");
    if(/<\s*(?:[\w-]+:)?svg(?:\s|>)/i.test(utf8)) return true;
    if(header[0] === 0xff && header[1] === 0xfe){
      const utf16 = new TextDecoder("utf-16le", {fatal:false}).decode(header);
      if(/<\s*(?:[\w-]+:)?svg(?:\s|>)/i.test(utf16)) return true;
    }
    return false;
  }

  async function isHeicUpload(file){
    const mime = String(file?.type || "").toLocaleLowerCase();
    const extension = String(file?.name || "").split(".").pop()?.toLocaleLowerCase() || "";
    if(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"].includes(mime) || ["heic", "heif", "heics", "heifs"].includes(extension)) return true;
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if(header.length < 12 || String.fromCharCode(...header.slice(4, 8)) !== "ftyp") return false;
    return ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(String.fromCharCode(...header.slice(8, 12)));
  }

  function loadHeicDecoder(invalidMessage){
    if(typeof window.heic2any === "function") return Promise.resolve(window.heic2any);
    if(heicDecoderPromise) return heicDecoderPromise;
    heicDecoderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let settled = false;
      let timeout = 0;
      const finish = (error, converter) => {
        if(settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if(error){
          heicDecoderPromise = null;
          script.remove();
          reject(error);
        } else resolve(converter);
      };
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js";
      script.integrity = "sha512-VjmsArkf8Vv2yyvbXCyVxp+R3n4N2WyS1GEQ+YQxa7Hu0tx836WpY4nW9/T1W5JBmvuIsxkVH/DlHgp7NEMjDw==";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.dataset.heicDecoder = "";
      timeout = window.setTimeout(() => finish(new Error(t("heicDecoderUnavailable"))), 15000);
      script.onload = () => {
        if(typeof window.heic2any === "function") finish(null, window.heic2any);
        else finish(new Error(invalidMessage));
      };
      script.onerror = () => finish(new Error(t("heicDecoderUnavailable")));
      document.head.append(script);
    });
    return heicDecoderPromise;
  }

  async function convertHeicForBrowser(file, invalidMessage){
    const converter = await loadHeicDecoder(invalidMessage);
    const converted = await converter({blob:file, toType:"image/jpeg", quality:.94});
    const result = Array.isArray(converted) ? converted[0] : converted;
    if(!(result instanceof Blob) || !result.size) throw new Error(invalidMessage);
    return result.type === "image/jpeg" ? result : new Blob([result], {type:"image/jpeg"});
  }

  async function decodeRasterFile(file, invalidMessage, allowHeicFallback=true){
    if(typeof createImageBitmap === "function"){
      try {
        const bitmap = await createImageBitmap(file, {imageOrientation:"from-image"});
        return {source:bitmap, width:bitmap.width, height:bitmap.height, cleanup:() => bitmap.close()};
      } catch(_bitmapOptionsError){
        try {
          const bitmap = await createImageBitmap(file);
          return {source:bitmap, width:bitmap.width, height:bitmap.height, cleanup:() => bitmap.close()};
        } catch(_bitmapError){}
      }
    }
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const candidate = new Image();
        candidate.onload = () => resolve(candidate);
        candidate.onerror = () => reject(new Error(invalidMessage));
        candidate.src = objectUrl;
      });
      return {
        source:image,
        width:Number(image.naturalWidth || image.width || 0),
        height:Number(image.naturalHeight || image.height || 0),
        cleanup:() => URL.revokeObjectURL(objectUrl)
      };
    } catch(error){
      URL.revokeObjectURL(objectUrl);
      if(allowHeicFallback && await isHeicUpload(file)){
        const converted = await convertHeicForBrowser(file, invalidMessage);
        return decodeRasterFile(converted, invalidMessage, false);
      }
      throw error;
    }
  }

  function canvasBlob(canvas, mimeType, quality){
    return new Promise(resolve => {
      if(typeof canvas.toBlob === "function"){
        try { canvas.toBlob(resolve, mimeType, quality); }
        catch(_error){ resolve(null); }
        return;
      }
      try {
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
        if(!match){ resolve(null); return; }
        const binary = atob(match[2]);
        const bytes = new Uint8Array(binary.length);
        for(let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        resolve(new Blob([bytes], {type:match[1]}));
      } catch(_error){ resolve(null); }
    });
  }

  async function encodeNormalizedCanvas(canvas, options={}){
    const maxBytes = Number(options.maxOutputBytes || 8 * 1024 * 1024);
    const quality = Math.max(.55, Math.min(.95, Number(options.quality || .86)));
    const attempts = [
      {canvas, mimeType:"image/webp", extension:"webp", quality},
      {canvas, mimeType:"image/webp", extension:"webp", quality:Math.max(.62, quality - .12)},
      {canvas, mimeType:"image/png", extension:"png"}
    ];
    for(const attempt of attempts){
      const blob = await canvasBlob(attempt.canvas, attempt.mimeType, attempt.quality);
      if(blob?.size && String(blob.type).toLocaleLowerCase() === attempt.mimeType && blob.size <= maxBytes){
        return {blob, mimeType:attempt.mimeType, extension:attempt.extension};
      }
    }

    const flattened = document.createElement("canvas");
    flattened.width = canvas.width;
    flattened.height = canvas.height;
    const context = flattened.getContext("2d", {alpha:false});
    if(context){
      context.fillStyle = options.background || "#f7f7f5";
      context.fillRect(0, 0, flattened.width, flattened.height);
      context.drawImage(canvas, 0, 0);
      for(const jpegQuality of [Math.min(.92, quality), Math.max(.68, quality - .12), .58]){
        const blob = await canvasBlob(flattened, "image/jpeg", jpegQuality);
        if(blob?.size && String(blob.type).toLocaleLowerCase() === "image/jpeg" && blob.size <= maxBytes){
          return {blob, mimeType:"image/jpeg", extension:"jpg"};
        }
      }
    }
    throw new Error(options.outputTooLargeMessage || options.tooLargeMessage || options.invalidMessage || t("mediaInvalid"));
  }

  async function normalizeRasterUpload(file, options={}){
    const invalidMessage = options.invalidMessage || t("mediaInvalid");
    const tooLargeMessage = options.tooLargeMessage || t("imageTooLarge");
    if(!(file instanceof Blob) || !file.size) throw new Error(invalidMessage);
    if(file.size > Number(options.maxInputBytes || 25 * 1024 * 1024)) throw new Error(tooLargeMessage);
    if(await isSvgUpload(file)) throw new Error(options.svgMessage || t("svgUnsupported"));
    const decoded = await decodeRasterFile(file, invalidMessage);
    try {
      const width = Number(decoded.width || 0);
      const height = Number(decoded.height || 0);
      const minDimension = Number(options.minDimension || 1);
      if(width < minDimension || height < minDimension || width > 20000 || height > 20000 || width * height > 100000000) throw new Error(invalidMessage);
      const square = options.square === true;
      const maxEdge = Number(options.maxEdge || 2048);
      const scale = square ? 1 : Math.min(1, maxEdge / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = square ? Number(options.size || 512) : Math.max(1, Math.round(width * scale));
      canvas.height = square ? Number(options.size || 512) : Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d", {alpha:!square});
      if(!context) throw new Error(invalidMessage);
      if(square){
        context.fillStyle = options.background || "#f5f5f7";
        context.fillRect(0, 0, canvas.width, canvas.height);
        const side = Math.min(width, height);
        context.drawImage(decoded.source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
      } else {
        context.drawImage(decoded.source, 0, 0, width, height, 0, 0, canvas.width, canvas.height);
      }
      const encoded = await encodeNormalizedCanvas(canvas, {...options, invalidMessage});
      return {...encoded, width:canvas.width, height:canvas.height};
    } finally {
      decoded.cleanup();
    }
  }

  const normalizeRasterToWebP = normalizeRasterUpload;

  async function prepareProfileAvatar(file){
    if(!file || !currentUser) return;
    const context = requestContext();
    const operation = ++hubState.avatarOperation;
    hubState.avatarBusy = true;
    setProfileFormDisabled(false);
    setStatus("avatarUploadStatus", t("avatarPreparing"));
    try {
      const normalized = await normalizeRasterUpload(file, {
        square:true,
        size:512,
        minDimension:16,
        maxInputBytes:20 * 1024 * 1024,
        maxOutputBytes:2 * 1024 * 1024,
        quality:.88,
        invalidMessage:t("avatarInvalid"),
        tooLargeMessage:t("avatarTooLarge"),
        svgMessage:t("avatarSvgUnsupported")
      });
      if(!contextIsCurrent(context) || operation !== hubState.avatarOperation) return;
      if(hubState.avatarPendingUrl) URL.revokeObjectURL(hubState.avatarPendingUrl);
      hubState.avatarPendingBlob = normalized.blob;
      hubState.avatarPendingUrl = URL.createObjectURL(normalized.blob);
      hubState.avatarPendingMimeType = normalized.mimeType;
      hubState.avatarPendingExtension = normalized.extension;
      hubState.avatarDeleteRequested = false;
      hubState.profileDirty = true;
      setStatus("avatarUploadStatus", t("avatarReady"), "success");
    } catch(error){
      if(contextIsCurrent(context) && operation === hubState.avatarOperation) setStatus("avatarUploadStatus", error?.message || t("avatarInvalid"), "error");
    } finally {
      if(contextIsCurrent(context) && operation === hubState.avatarOperation){
        hubState.avatarBusy = false;
        setProfileFormDisabled(false);
        renderOwnAvatars();
        $("profileAvatarInput").value = "";
      }
    }
  }

  function markAvatarForRemoval(){
    if(hubState.avatarPendingUrl) URL.revokeObjectURL(hubState.avatarPendingUrl);
    hubState.avatarPendingUrl = "";
    hubState.avatarPendingBlob = null;
    hubState.avatarPendingMimeType = "";
    hubState.avatarPendingExtension = "";
    hubState.avatarDeleteRequested = true;
    hubState.profileDirty = true;
    setStatus("avatarUploadStatus", t("avatarRemoved"));
    renderOwnAvatars();
  }

  async function removeAvatarObject(path, warning){
    if(!path || !authClient) return;
    try {
      const removal = await authClient.storage.from("member-avatars").remove([path]);
      if(removal.error) console.warn(warning, removal.error);
    } catch(error){
      console.warn(warning, error);
    }
  }

  async function loadMemberProfile({force=false}={}){
    if(!authClient || !currentUser) return;
    const context = requestContext();
    if(hubState.profileLoading) return;
    if(!force && hubState.profileUserId === context.userId){
      hubState.profileHydrated = true;
      if(!hubState.profileDirty) fillMemberProfile(hubState.profile || {});
      setProfileFormDisabled(false);
      return;
    }
    const request = ++hubState.profileRequest;
    hubState.profileLoading = true;
    $("saveMemberProfile").disabled = true;
    if(!hubState.profileHydrated) setProfileFormDisabled(true);
    setStatus("memberProfileStatus", t("profileLoading"));
    const { data, error } = await authClient
      .from("member_profiles")
      .select("display_name, bio, phone_number, interests, avatar_path, avatar_revision, instagram_url, whatsapp_url, linkedin_url, wechat_id, share_wechat, website_url, profile_visibility, allow_messages, analytics_consent")
      .eq("user_id", context.userId)
      .maybeSingle();
    if(!contextIsCurrent(context) || request !== hubState.profileRequest) return;
    if(error){
      hubState.profileLoading = false;
      hubState.profileHydrated = true;
      setProfileFormDisabled(false);
      renderMessageAvailability();
      setStatus("memberProfileStatus", featureError(error), "error");
      return;
    }
    hubState.profile = data || {};
    hubState.profileUserId = context.userId;
    hubState.profileLoading = false;
    hubState.profileHydrated = true;
    if(!hubState.profileDirty) fillMemberProfile(hubState.profile);
    setProfileFormDisabled(false);
    setStatus("memberProfileStatus", "");
    renderOverview();
  }

  async function saveMemberProfile(){
    if(!authClient || !currentUser || hubState.profileLoading || hubState.avatarBusy || !hubState.profileHydrated) return false;
    const context = requestContext();
    const button = $("saveMemberProfile");
    let payload;
    const previousAvatarPath = hubState.profile?.avatar_path || null;
    const previousAvatarRevision = Number(hubState.profile?.avatar_revision || 0);
    try {
      payload = {
        user_id: context.userId,
        display_name: $("profileDisplayName").value.trim() || null,
        phone_number: $("profilePhone").value.trim() || null,
        bio: $("profileBio").value.trim() || null,
        interests: parseInterests($("profileInterests").value),
        avatar_path: previousAvatarPath,
        avatar_revision: previousAvatarRevision,
        instagram_url: validatedUrl($("profileInstagram").value, "instagram"),
        whatsapp_url: validatedUrl($("profileWhatsapp").value, "whatsapp"),
        linkedin_url: validatedUrl($("profileLinkedin").value, "linkedin"),
        wechat_id: validatedWechatId($("profileWechat").value),
        share_wechat: $("profileShareWechat").checked,
        website_url: validatedUrl($("profileWebsite").value, "website"),
        profile_visibility: $("profileVisibility").value,
        allow_messages: $("profileAllowMessages").checked,
        analytics_consent: $("profileAnalyticsConsent").checked
      };
    } catch(error){
      button.disabled = false;
      setStatus("memberProfileStatus", error.message, "error");
      return false;
    }

    button.disabled = true;
    hubState.avatarBusy = true;
    setProfileFormDisabled(true);
    setStatus("memberProfileStatus", t("saving"));
    let uploadedAvatarPath = "";
    if(hubState.avatarPendingBlob){
      const avatarMimeType = hubState.avatarPendingMimeType || hubState.avatarPendingBlob.type || "image/webp";
      const avatarExtension = hubState.avatarPendingExtension || ({"image/jpeg":"jpg", "image/png":"png", "image/webp":"webp"}[avatarMimeType] || "webp");
      uploadedAvatarPath = `${context.userId}/avatar-${crypto.randomUUID()}.${avatarExtension}`;
      let upload;
      try {
        upload = await authClient.storage.from("member-avatars").upload(uploadedAvatarPath, hubState.avatarPendingBlob, {
          upsert:false,
          contentType:avatarMimeType,
          cacheControl:"31536000"
        });
      } catch(error){
        await removeAvatarObject(uploadedAvatarPath, "An interrupted avatar upload left an owner-private object for later cleanup.");
        if(!contextIsCurrent(context)) return false;
        hubState.avatarBusy = false;
        setProfileFormDisabled(false);
        button.disabled = false;
        const message = mediaUploadError(wrapMediaUploadError(error, "member-avatars"));
        setStatus("memberProfileStatus", message, "error");
        setStatus("avatarUploadStatus", message, "error");
        return false;
      }
      if(upload.error){
        await removeAvatarObject(uploadedAvatarPath, "An ambiguous avatar upload left an owner-private object for later cleanup.");
        if(!contextIsCurrent(context)) return false;
        hubState.avatarBusy = false;
        setProfileFormDisabled(false);
        button.disabled = false;
        const message = mediaUploadError(wrapMediaUploadError(upload.error, "member-avatars"));
        setStatus("memberProfileStatus", message, "error");
        setStatus("avatarUploadStatus", message, "error");
        return false;
      }
      if(!contextIsCurrent(context)) return false;
      payload.avatar_path = uploadedAvatarPath;
      payload.avatar_revision = previousAvatarRevision + 1;
    } else if(hubState.avatarDeleteRequested){
      payload.avatar_path = null;
      payload.avatar_revision = previousAvatarRevision + 1;
    }

    let data;
    let error;
    try {
      ({data, error} = await authClient.from("member_profiles").upsert(payload, {onConflict:"user_id"}).select().single());
    } catch(requestError){
      await removeAvatarObject(uploadedAvatarPath, "A failed profile save left an owner-private avatar object for later cleanup.");
      if(!contextIsCurrent(context)) return false;
      hubState.avatarBusy = false;
      setProfileFormDisabled(false);
      button.disabled = false;
      setStatus("memberProfileStatus", featureError(requestError) || t("profileSaveFailed"), "error");
      return false;
    }
    if(error){
      await removeAvatarObject(uploadedAvatarPath, "A failed profile save left an owner-private avatar object for later cleanup.");
      if(!contextIsCurrent(context)) return false;
      hubState.avatarBusy = false;
      setProfileFormDisabled(false);
      button.disabled = false;
      setStatus("memberProfileStatus", featureError(error) || t("profileSaveFailed"), "error");
      return false;
    }
    if(!contextIsCurrent(context)) return false;
    hubState.avatarBusy = false;
    setProfileFormDisabled(false);
    button.disabled = false;
    const obsoleteAvatarPath = previousAvatarPath && previousAvatarPath !== data.avatar_path ? previousAvatarPath : "";
    hubState.avatarPendingBlob = null;
    hubState.avatarPendingMimeType = "";
    hubState.avatarPendingExtension = "";
    hubState.avatarDeleteRequested = false;
    revokeAvatarUrls();
    hubState.profile = data;
    hubState.profileUserId = context.userId;
    hubState.profileDirty = false;
    renderMessageAvailability();
    setStatus("avatarUploadStatus", "");
    setStatus("memberProfileStatus", t("profileSaved"), "success");
    renderOverview();
    if(obsoleteAvatarPath){
      await removeAvatarObject(obsoleteAvatarPath, "The removed avatar is no longer referenced, but its private storage object could not be deleted.");
    }
    if(!contextIsCurrent(context)) return false;
    if(finalTimetable?.savedAt) await syncFinalSchedule(finalTimetable);
    if(!contextIsCurrent(context)) return false;
    return true;
  }

  function parseJsonValue(value, fallback){
    if(value == null) return fallback;
    if(typeof value !== "string") return value;
    try { return JSON.parse(value); }
    catch(_error){ return fallback; }
  }

  function updateCommunityPostCounter(){
    if(!$("communityPostBody") || !$("communityPostCounter")) return;
    $("communityPostCounter").textContent = `${$("communityPostBody").value.length} / 1200`;
  }

  function createPollOptionInput(value="", number=1){
    const input = node("input", "hub-poll-option-input");
    input.maxLength = 100;
    input.dataset.pollOption = "";
    input.dataset.pollNumber = String(number);
    input.placeholder = t("pollOptionPlaceholder");
    input.setAttribute("aria-label", t("pollOptionNumber", {number}));
    input.value = value;
    return input;
  }

  function resetCommunityPoll({restoreFocus=false}={}){
    const builder = $("communityPollBuilder");
    const question = $("communityPollQuestion");
    const list = $("communityPollOptions");
    const trigger = $("addCommunityPoll");
    if(builder) builder.hidden = true;
    if(trigger){
      trigger.setAttribute("aria-expanded", "false");
      trigger.classList.remove("is-active");
    }
    if(question) question.value = "";
    if(list) list.replaceChildren(createPollOptionInput("", 1), createPollOptionInput("", 2));
    if(restoreFocus) requestAnimationFrame(() => $("addCommunityPoll")?.focus());
  }

  function addCommunityPollOption(){
    const list = $("communityPollOptions");
    if(!list) return;
    if(list.querySelectorAll("[data-poll-option]").length >= 6){
      setStatus("communityComposerStatus", t("pollOptionLimit"), "error");
      return;
    }
    const input = createPollOptionInput("", list.querySelectorAll("[data-poll-option]").length + 1);
    list.append(input);
    input.focus();
  }

  function communityPollPayload(){
    if($("communityPollBuilder")?.hidden) return null;
    const question = $("communityPollQuestion").value.trim();
    const options = [...document.querySelectorAll("#communityPollOptions [data-poll-option]")]
      .map(input => input.value.trim())
      .filter(Boolean);
    if(!question || options.length < 2) throw new Error(t("pollIncomplete"));
    if(new Set(options.map(option => option.toLocaleLowerCase())).size !== options.length) throw new Error(t("pollDuplicateOptions"));
    return {question, options:options.slice(0, 6)};
  }

  function setCommunityComposerBusy(busy){
    hubState.composerMediaBusy = busy;
    document.querySelectorAll(".hub-compose-card button, .hub-compose-card input, .hub-compose-card textarea")
      .forEach(control => { control.disabled = busy; });
  }

  function renderComposerMedia(){
    const preview = $("communityMediaPreview");
    if(!preview) return;
    preview.replaceChildren();
    hubState.composerMedia.forEach((item, index) => {
      const card = node("article", "hub-media-preview-item");
      if(item.kind === "video"){
        const video = node("video");
        video.src = item.previewUrl;
        video.controls = true;
        video.muted = true;
        video.preload = "metadata";
        video.setAttribute("aria-label", item.altText || t("postVideo"));
        card.append(video);
      } else {
        const image = node("img");
        image.src = item.previewUrl;
        image.alt = item.altText || "";
        card.append(image);
      }
      const remove = node("button", "hub-media-preview-remove", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", t("removeMedia"));
      remove.onclick = () => {
        URL.revokeObjectURL(item.previewUrl);
        hubState.composerMedia = hubState.composerMedia.filter(candidate => candidate.id !== item.id);
        renderComposerMedia();
        requestAnimationFrame(() => {
          const remaining = [...preview.querySelectorAll(".hub-media-preview-remove")];
          (remaining[Math.min(index, Math.max(0, remaining.length - 1))] || $("addCommunityMedia"))?.focus();
        });
      };
      card.append(remove);
      const alt = node("input", "hub-media-alt");
      alt.maxLength = 180;
      alt.placeholder = item.kind === "video" ? t("videoDescriptionPlaceholder") : t("altTextPlaceholder");
      alt.setAttribute("aria-label", t("mediaDescriptionNumber", {number:index + 1}));
      alt.value = item.altText || "";
      alt.addEventListener("input", () => { item.altText = alt.value; });
      card.append(alt);
      preview.append(card);
    });
  }

  function videoUploadType(file){
    const mime = String(file.type || "").toLocaleLowerCase();
    const extension = String(file.name || "").split(".").pop()?.toLocaleLowerCase() || "";
    if(mime === "video/mp4" || extension === "mp4") return {mimeType:"video/mp4", extension:"mp4"};
    if(mime === "video/webm" || extension === "webm") return {mimeType:"video/webm", extension:"webm"};
    if(mime === "video/quicktime" || ["mov", "qt"].includes(extension)) return {mimeType:"video/quicktime", extension:"mov"};
    return null;
  }

  async function validateVideoSignature(file, type){
    if(!(file instanceof Blob) || !file.size) throw new Error(t("mediaInvalid"));
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const isWebM = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    const isIsoMedia = bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
    if(type.mimeType === "video/webm" ? !isWebM : !isIsoMedia) throw new Error(t("videoInvalid"));
  }

  async function prepareCommunityMedia(files){
    const candidates = [...(files || [])];
    if(!candidates.length || hubState.composerMediaBusy || !currentUser) return;
    const context = requestContext();
    const operation = ++hubState.mediaPrepareOperation;
    const available = 4 - hubState.composerMedia.length;
    if(available <= 0){ setStatus("communityComposerStatus", t("mediaLimit"), "error"); return; }
    setCommunityComposerBusy(true);
    setStatus("communityComposerStatus", t("mediaPreparing"));
    let lastError = "";
    const prepared = [];
    let committed = false;
    try {
      for(const file of candidates.slice(0, available)){
        if(!contextIsCurrent(context) || operation !== hubState.mediaPrepareOperation) return;
        try {
          const videoType = videoUploadType(file);
          if(videoType){
            if(file.size > 40 * 1024 * 1024) throw new Error(t("videoTooLarge"));
            await validateVideoSignature(file, videoType);
            if(!contextIsCurrent(context) || operation !== hubState.mediaPrepareOperation) return;
            prepared.push({
              id:crypto.randomUUID(), kind:"video", blob:file, mimeType:videoType.mimeType,
              extension:videoType.extension, previewUrl:URL.createObjectURL(file), altText:""
            });
          } else {
            const normalized = await normalizeRasterUpload(file, {
              maxEdge:2048,
              maxInputBytes:25 * 1024 * 1024,
              maxOutputBytes:8 * 1024 * 1024,
              quality:.86,
              invalidMessage:t("mediaInvalid"),
              tooLargeMessage:t("imageTooLarge"),
              svgMessage:t("svgUnsupported")
            });
            if(!contextIsCurrent(context) || operation !== hubState.mediaPrepareOperation) return;
            prepared.push({
              id:crypto.randomUUID(), kind:"image", blob:normalized.blob, mimeType:normalized.mimeType,
              extension:normalized.extension, previewUrl:URL.createObjectURL(normalized.blob), altText:"",
              width:normalized.width, height:normalized.height
            });
          }
        } catch(error){
          lastError = error?.message || t("mediaInvalid");
        }
      }
      if(!contextIsCurrent(context) || operation !== hubState.mediaPrepareOperation) return;
      if(candidates.length > available) lastError = t("mediaLimit");
      hubState.composerMedia.push(...prepared);
      committed = true;
      renderComposerMedia();
      setStatus("communityComposerStatus", lastError || t("mediaReady"), lastError ? "error" : "success");
    } finally {
      if(!committed) prepared.forEach(item => URL.revokeObjectURL(item.previewUrl));
      if(contextIsCurrent(context) && operation === hubState.mediaPrepareOperation){
        setCommunityComposerBusy(false);
        if($("communityMediaInput")) $("communityMediaInput").value = "";
      }
    }
  }

  async function removeCommunityUploads(paths){
    if(!paths.length) return;
    try {
      const removal = await authClient.storage.from("community-media").remove(paths);
      if(removal.error) console.warn("Owner-private post media cleanup was deferred.", removal.error);
    } catch(error){
      console.warn("Owner-private post media cleanup was deferred.", error);
    }
  }

  async function uploadCommunityMedia(draftId, items, context, operation){
    const paths = [];
    const descriptors = [];
    for(const [position, item] of items.entries()){
      if(!contextIsCurrent(context) || operation !== hubState.publishOperation) throw new Error("Stale publish operation");
      const path = `${context.userId}/posts/${draftId}/${crypto.randomUUID()}.${item.extension}`;
      let upload;
      try {
        upload = await authClient.storage.from("community-media").upload(path, item.blob, {
          upsert:false,
          contentType:item.mimeType,
          cacheControl:"31536000"
        });
      } catch(error){
        await removeCommunityUploads([...paths, path]);
        throw wrapMediaUploadError(error, "community-media");
      }
      if(upload.error){
        await removeCommunityUploads([...paths, path]);
        throw wrapMediaUploadError(upload.error, "community-media");
      }
      if(!contextIsCurrent(context) || operation !== hubState.publishOperation){
        await removeCommunityUploads([...paths, path]);
        throw new Error("Stale publish operation");
      }
      paths.push(path);
      descriptors.push({
        storage_path:path,
        media_type:item.kind,
        mime_type:item.mimeType,
        alt_text:item.altText.trim() || null,
        position
      });
    }
    return {paths, descriptors};
  }

  async function getCommunityMediaUrl(path){
    if(!path || !authClient || !currentUser) return "";
    const cached = hubState.communityMediaUrlCache.get(path);
    if(cached?.url) return cached.url;
    const cacheKey = `image:${path}`;
    if(hubState.communityMediaLoadCache.has(cacheKey)) return hubState.communityMediaLoadCache.get(cacheKey);
    const generation = hubState.generation;
    const userId = currentUser.id;
    const pending = authClient.storage.from("community-media").download(path).then(({data, error}) => {
      if(error || !data) throw error || new Error(t("mediaUnavailable"));
      const url = URL.createObjectURL(data);
      if(generation !== hubState.generation || currentUser?.id !== userId){ URL.revokeObjectURL(url); return ""; }
      const entry = {url, consumers:new Set(), createdAt:Date.now()};
      hubState.communityMediaUrlCache.set(path, entry);
      window.setTimeout(() => {
        if(hubState.communityMediaUrlCache.get(path) === entry && entry.consumers.size === 0){
          URL.revokeObjectURL(entry.url);
          hubState.communityMediaUrlCache.delete(path);
        }
      }, 0);
      return url;
    }).finally(() => hubState.communityMediaLoadCache.delete(cacheKey));
    hubState.communityMediaLoadCache.set(cacheKey, pending);
    return pending;
  }

  function retainCommunityMediaUrl(path, url, holder){
    const entry = hubState.communityMediaUrlCache.get(path);
    if(!entry || entry.url !== url) return false;
    entry.consumers.add(holder);
    return true;
  }

  function releaseCommunityMediaUrl(path, holder){
    const entry = hubState.communityMediaUrlCache.get(path);
    if(!entry) return;
    entry.consumers.delete(holder);
    if(entry.consumers.size === 0){
      URL.revokeObjectURL(entry.url);
      hubState.communityMediaUrlCache.delete(path);
    }
  }

  async function getCommunityVideoUrl(path, {force=false}={}){
    if(!path || !authClient || !currentUser) return "";
    const context = requestContext();
    const cacheKey = `video:${path}`;
    if(force && hubState.communityMediaLoadCache.has(cacheKey)){
      try { await hubState.communityMediaLoadCache.get(cacheKey); }
      catch(_error){}
    }
    if(!contextIsCurrent(context)) return "";
    if(force) hubState.communityVideoUrlCache.delete(path);
    const cached = hubState.communityVideoUrlCache.get(path);
    if(cached?.url && cached.expiresAt > Date.now() + 30_000) return cached.url;
    if(hubState.communityMediaLoadCache.has(cacheKey)) return hubState.communityMediaLoadCache.get(cacheKey);
    const pending = authClient.storage.from("community-media").createSignedUrl(path, 3600).then(({data, error}) => {
      if(error || !data?.signedUrl) throw error || new Error(t("mediaUnavailable"));
      if(!contextIsCurrent(context)) return "";
      hubState.communityVideoUrlCache.set(path, {url:data.signedUrl, expiresAt:Date.now() + 3_540_000});
      return data.signedUrl;
    }).finally(() => hubState.communityMediaLoadCache.delete(cacheKey));
    hubState.communityMediaLoadCache.set(cacheKey, pending);
    return pending;
  }

  function renderPostMedia(post){
    const items = parseJsonValue(post.media, []);
    if(!Array.isArray(items) || !items.length) return null;
    const media = node("div", "hub-post-media");
    const visible = items.slice(0, 4).sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
    media.dataset.count = String(visible.length);
    const context = requestContext();
    visible.forEach(item => {
      const holder = node("div", "hub-post-media-item");
      holder.dataset.communityMediaPending = "";
      holder.append(node("span", "hub-media-loading", t("mediaLoading")));
      media.append(holder);
      let wanted = false;
      let loading = false;
      let loadedUrl = "";
      let loadedKind = "";

      const unload = () => {
        wanted = false;
        if(loadedKind === "image") releaseCommunityMediaUrl(item.storage_path, holder);
        const video = holder.querySelector("video");
        if(video){
          video.pause();
          video.removeAttribute("src");
          video.load();
        }
        loadedUrl = "";
        loadedKind = "";
        if(holder.isConnected) holder.replaceChildren(node("span", "hub-media-loading", t("mediaLoading")));
      };

      const load = () => {
        wanted = true;
        if(loading || loadedUrl || !holder.isConnected || !contextIsCurrent(context)) return;
        loading = true;
        delete holder.dataset.communityMediaPending;
        const mediaRequest = item.media_type === "video"
          ? getCommunityVideoUrl(item.storage_path)
          : getCommunityMediaUrl(item.storage_path);
        mediaRequest.then(url => {
          loading = false;
          if(!url || !wanted || !holder.isConnected || !contextIsCurrent(context)) return;
          holder.replaceChildren();
          if(item.media_type === "video"){
            const video = node("video");
            video.src = url;
            video.controls = true;
            video.preload = "metadata";
            video.playsInline = true;
            video.setAttribute("aria-label", item.alt_text || t("postVideo"));
            const refreshVideoUrl = async (force=false) => {
              const cachedVideo = hubState.communityVideoUrlCache.get(item.storage_path);
              if(!force && cachedVideo?.expiresAt > Date.now() + 120_000) return;
              if(video.dataset.refreshing === "true") return;
              video.dataset.refreshing = "true";
              const resume = !video.paused;
              const resumeAt = Number(video.currentTime || 0);
              try {
                const freshUrl = await getCommunityVideoUrl(item.storage_path, {force:true});
                if(!freshUrl || !wanted || !video.isConnected || !contextIsCurrent(context)) return;
                loadedUrl = freshUrl;
                video.src = freshUrl;
                video.preload = "metadata";
                if(resumeAt > 0 || resume){
                  video.addEventListener("loadedmetadata", () => {
                    try { if(resumeAt > 0) video.currentTime = resumeAt; }
                    catch(_error){}
                    if(resume) void video.play().catch(() => {});
                  }, {once:true});
                }
              } catch(_error){}
              finally { delete video.dataset.refreshing; }
            };
            video.addEventListener("play", () => { void refreshVideoUrl(false); });
            video.addEventListener("error", () => {
              const cachedVideo = hubState.communityVideoUrlCache.get(item.storage_path);
              if(cachedVideo?.expiresAt <= Date.now() + 30_000 && video.dataset.refreshAttempted !== "true"){
                video.dataset.refreshAttempted = "true";
                void refreshVideoUrl(true);
              }
            });
            holder.append(video);
            loadedKind = "video";
          } else {
            if(!retainCommunityMediaUrl(item.storage_path, url, holder)){
              window.setTimeout(load, 0);
              return;
            }
            const image = node("img");
            image.src = url;
            image.alt = item.alt_text || "";
            image.loading = "lazy";
            image.decoding = "async";
            holder.append(image);
            loadedKind = "image";
          }
          loadedUrl = url;
        }).catch(() => {
          loading = false;
          if(holder.isConnected && wanted && contextIsCurrent(context)) holder.replaceChildren(node("span", "hub-media-loading", t("mediaUnavailable")));
        });
      };
      holder._unloadCommunityMedia = unload;
      if(communityMediaObserver){
        holder._loadCommunityMedia = load;
        communityMediaObserver.observe(holder);
      } else load();
    });
    return media;
  }

  async function voteCommunityPoll(pollId, optionId){
    if(hubState.feedScope === "cross") return;
    if(hubState.pollBusy.has(pollId)) return;
    hubState.pollBusy.add(pollId);
    document.querySelectorAll(`[data-poll-id="${pollId}"]`).forEach(button => { button.disabled = true; });
    const context = requestContext();
    try {
      const { error } = await authClient.rpc("vote_community_poll", {p_poll_id:pollId, p_option_id:optionId});
      if(!contextIsCurrent(context)) return;
      if(error){ setStatus("communityComposerStatus", featureError(error), "error"); return; }
      await loadCommunityFeed({force:true});
    } finally {
      if(contextIsCurrent(context)){
        hubState.pollBusy.delete(pollId);
        document.querySelectorAll(`[data-poll-id="${pollId}"]`).forEach(button => { button.disabled = false; });
      }
    }
  }

  function renderPostPoll(post){
    const poll = parseJsonValue(post.poll, null);
    if(!poll || !poll.poll_id || !Array.isArray(poll.options) || poll.options.length < 2) return null;
    const wrapper = node("section", "hub-post-poll");
    wrapper.append(node("b", "", poll.question || ""));
    const total = Number(poll.total_votes ?? poll.options.reduce((sum, option) => sum + Number(option.vote_count || 0), 0));
    const selected = poll.selected_option_id || "";
    poll.options.forEach(option => {
      const optionId = option.option_id;
      const count = Number(option.vote_count || 0);
      const percent = total ? Math.round(count / total * 100) : 0;
      const button = node("button", `hub-poll-choice${selected === optionId ? " selected" : ""}`);
      button.type = "button";
      button.dataset.pollId = poll.poll_id;
      button.disabled = hubState.feedScope === "cross" || hubState.pollBusy.has(poll.poll_id);
      button.setAttribute("aria-pressed", selected === optionId ? "true" : "false");
      if(selected){
        const fill = node("span", "hub-poll-choice-fill");
        fill.style.width = `${percent}%`;
        button.append(fill);
      }
      const copy = node("span", "hub-poll-choice-copy");
      copy.append(node("span", "", option.label || option.option_text || ""), node("b", "", selected ? `${percent}%` : ""));
      button.append(copy);
      button.onclick = () => voteCommunityPoll(poll.poll_id, optionId);
      wrapper.append(button);
    });
    wrapper.append(node("span", "hub-poll-summary", t(total === 1 ? "oneVote" : "votesCount", {count:total})));
    if(hubState.feedScope === "cross"){
      const note = node("span", "hub-poll-readonly-note", t("worldwidePollReadOnly"));
      note.setAttribute("role", "note");
      wrapper.append(note);
    }
    return wrapper;
  }

  async function togglePostBookmark(postId){
    const post = hubState.feed.find(item => item.post_id === postId);
    if(!post || hubState.bookmarkBusy.has(postId)) return;
    hubState.bookmarkBusy.add(postId);
    const previous = post.bookmarked_by_me === true;
    post.bookmarked_by_me = !previous;
    const optimisticButton = document.querySelector(`[data-bookmark-post="${postId}"]`);
    if(optimisticButton){
      optimisticButton.disabled = true;
      optimisticButton.textContent = post.bookmarked_by_me ? t("postSaved") : t("savePost");
      optimisticButton.classList.toggle("bookmarked", post.bookmarked_by_me);
      optimisticButton.setAttribute("aria-pressed", post.bookmarked_by_me ? "true" : "false");
    }
    if(hubState.feedTopic === "saved" && !post.bookmarked_by_me) renderCommunityFeed(hubState.feed);
    const context = requestContext();
    try {
      const { data, error } = await hubRpc("toggle_post_bookmark", {p_post_id:postId});
      if(!contextIsCurrent(context)) return;
      if(error){
        post.bookmarked_by_me = previous;
        renderCommunityFeed(hubState.feed);
        setStatus("communityComposerStatus", featureError(error), "error");
        return;
      }
      post.bookmarked_by_me = data === true;
      if(hubState.feedTopic === "saved" && !post.bookmarked_by_me) hubState.feedOffset = Math.max(0, hubState.feedOffset - 1);
      renderCommunityFeed(hubState.feed);
    } catch(requestError){
      if(contextIsCurrent(context)){
        post.bookmarked_by_me = previous;
        renderCommunityFeed(hubState.feed);
        setStatus("communityComposerStatus", featureError(requestError), "error");
      }
    } finally {
      if(contextIsCurrent(context)){
        hubState.bookmarkBusy.delete(postId);
        const button = document.querySelector(`[data-bookmark-post="${postId}"]`);
        if(button) button.disabled = false;
      }
    }
  }

  async function shareCommunityPost(postId){
    const url = new URL(window.location.href);
    url.hash = `${hubState.feedScope === "cross" ? "cross-post" : "post"}-${postId}`;
    if(navigator.share){
      try {
        await navigator.share({title:"ConCourse", text:t("sharedPostMessage"), url:url.toString()});
        return;
      } catch(error){
        if(error?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      setStatus("communityComposerStatus", t("postLinkCopied"), "success");
    } catch(_error){
      setStatus("communityComposerStatus", t("shareFailed"), "error");
    }
  }

  function clearCommunityComposer(){
    hubState.composerMedia.forEach(item => URL.revokeObjectURL(item.previewUrl));
    hubState.composerMedia = [];
    $("communityPostBody").value = "";
    $("communityPostTags").value = "";
    $("communityCrossCampus").checked = false;
    renderComposerMedia();
    resetCommunityPoll();
    window.ConCourseMarketplace?.clearCommunityListing();
    updateCommunityPostCounter();
  }

  function postAuthorName(post){
    return identityLabel(post.display_name, post.author_username);
  }

  function communityTopicMatches(post, topic){
    if(!topic || topic === "all") return true;
    if(topic === "saved") return post.bookmarked_by_me === true;
    const topicTerms = {
      courses:["course", "courses", "class", "classes", "module", "modules", "timetable", "课程", "課程", "選科", "选课"],
      campus:["campus", "school", "student", "students", "life", "校园", "校園", "学生", "學生"],
      clubs:["club", "clubs", "society", "societies", "社团", "社團", "学会", "學會"],
      housing:["housing", "dorm", "dormitory", "rent", "roommate", "住宿", "宿舍", "租房"],
      careers:["career", "careers", "intern", "internship", "job", "jobs", "职业", "職涯", "实习", "實習"]
    };
    const poll = parseJsonValue(post.poll, null);
    const pollCopy = poll ? [poll.question, ...(Array.isArray(poll.options) ? poll.options.map(option => option.label || option.option_text) : [])] : [];
    const haystack = [post.body, ...pollCopy, ...(Array.isArray(post.tags) ? post.tags : [])].join(" ").toLocaleLowerCase();
    return (topicTerms[topic] || [topic]).some(term => haystack.includes(term.toLocaleLowerCase()));
  }

  function filteredCommunityPosts(posts){
    const query = hubState.feedQuery.trim().toLocaleLowerCase();
    return posts.filter(post => {
      if(!communityTopicMatches(post, hubState.feedTopic)) return false;
      if(!query) return true;
      const poll = parseJsonValue(post.poll, null);
      const pollCopy = poll ? [poll.question, ...(Array.isArray(poll.options) ? poll.options.map(option => option.label || option.option_text) : [])] : [];
      return [post.body, ...pollCopy, post.display_name, post.author_username, post.school_name, post.major_of_study, ...(Array.isArray(post.tags) ? post.tags : [])]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    });
  }

  function syncCommunityTopicControls(){
    document.querySelectorAll("[data-community-topic]").forEach(item => {
      const active = item.dataset.communityTopic === hubState.feedTopic;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const savedShortcut = $("communityShowSaved");
    if(savedShortcut){
      savedShortcut.classList.toggle("active", hubState.feedTopic === "saved");
      savedShortcut.setAttribute("aria-pressed", hubState.feedTopic === "saved" ? "true" : "false");
    }
  }

  function syncCommunityScopeControls(){
    const crossCampus = hubState.feedScope === "cross";
    document.querySelectorAll("[data-community-scope]").forEach(button => {
      const active = button.dataset.communityScope === hubState.feedScope;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if($("memberHub")) $("memberHub").dataset.communityScope = hubState.feedScope;
    if($("communityComposer")) $("communityComposer").hidden = crossCampus;
    if($("communityFeedTitle")) $("communityFeedTitle").textContent = t(crossCampus ? "acrossCampusFeed" : "campusFeed");
    if($("communitySearch")) $("communitySearch").placeholder = t(crossCampus ? "searchAcrossCampuses" : "searchCommunity");
    if(hubState.activeView === "community") renderHubHeader();
    if(!crossCampus) setStatus("communityFeedStatus", "");
  }

  function communityFeedMode(){
    return `${hubState.feedScope}:${hubState.feedTopic === "saved" ? "saved" : "all"}`;
  }

  function communitySeedAvailable(){
    return (
      hubState.feedScope === "school"
      && hubState.feedTopic === "all"
      && !String(hubState.feedQuery || "").trim()
    );
  }

  function selectCommunityScope(scope="school"){
    const nextScope = scope === "cross" ? "cross" : "school";
    if(nextScope === hubState.feedScope) return;
    hubState.feedScope = nextScope;
    hubState.feed = [];
    hubState.communityFeedError = "";
    hubState.postCommentPages.clear();
    hubState.feedOffset = 0;
    hubState.feedHasMore = false;
    hubState.openCommentPostIds.clear();
    syncCommunityScopeControls();
    syncCommunityTopicControls();
    void loadCommunityFeed({force:true});
  }

  function selectCommunityTopic(topic="all"){
    hubState.feedTopic = topic;
    syncCommunityTopicControls();
    const nextMode = communityFeedMode();
    if(nextMode !== hubState.feedMode){
      hubState.feed = [];
      hubState.communityFeedError = "";
      hubState.postCommentPages.clear();
      hubState.feedOffset = 0;
      hubState.feedHasMore = false;
      void loadCommunityFeed({force:true});
    } else renderCommunityFeed(hubState.feed);
  }

  function closeHubAction(value=null, {restoreFocus=true}={}){
    const resolver = hubState.actionResolver;
    const returnFocus = hubState.actionReturnFocus;
    hubState.actionResolver = null;
    hubState.actionReturnFocus = null;
    hubState.actionHasInput = false;
    hubState.actionInputRequired = false;
    hubState.actionRequiredMessage = "";
    $("hubActionModal").hidden = true;
    $("hubActionInput").value = "";
    restoreBackgroundModals(hubState.actionBackgroundModals);
    hubState.actionBackgroundModals = [];
    if(resolver) resolver(value);
    if(restoreFocus && returnFocus?.isConnected) returnFocus.focus();
  }

  function suspendBackgroundModals(exceptModal){
    return [...document.querySelectorAll(".marketplace-modal:not([hidden]), .hub-profile-modal:not([hidden])")]
      .filter(modal => modal !== exceptModal)
      .map(modal => {
        const previousAriaHidden = modal.getAttribute("aria-hidden");
        modal.inert = true;
        modal.setAttribute("aria-hidden", "true");
        return {modal, previousAriaHidden};
      });
  }

  function restoreBackgroundModals(records=[]){
    records.forEach(({modal, previousAriaHidden}) => {
      if(!modal?.isConnected) return;
      modal.inert = false;
      if(previousAriaHidden === null) modal.removeAttribute("aria-hidden");
      else modal.setAttribute("aria-hidden", previousAriaHidden);
    });
  }

  function requestHubAction({title, message, input=false, inputRequired=input, inputMode="text", maxLength=500, placeholder=null, requiredMessage=null, confirmLabel, danger=false}){
    closeHubAction(null, {restoreFocus:false});
    hubState.actionReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    hubState.actionHasInput = input;
    hubState.actionInputRequired = input && inputRequired;
    hubState.actionRequiredMessage = requiredMessage || t("reasonRequired");
    $("hubActionTitle").textContent = title;
    $("hubActionMessage").textContent = message;
    const actionInput = $("hubActionInput");
    actionInput.hidden = !input;
    actionInput.placeholder = input ? (placeholder ?? t("reasonPlaceholder")) : "";
    actionInput.inputMode = input ? inputMode : "text";
    actionInput.maxLength = Math.min(2000, Math.max(1, Number(maxLength) || 500));
    $("hubActionConfirm").textContent = confirmLabel;
    $("hubActionConfirm").className = `btn-primary${danger ? " danger" : ""}`;
    $("hubActionModal").hidden = false;
    hubState.actionBackgroundModals = suspendBackgroundModals($("hubActionModal"));
    requestAnimationFrame(() => (input ? actionInput : $("hubActionConfirm")).focus());
    return new Promise(resolve => { hubState.actionResolver = resolve; });
  }

  function closeSchoolmateProfile({restoreFocus=true}={}){
    hubState.profilePreviewRequest += 1;
    $("schoolmateProfileModal").hidden = true;
    hubState.profilePreview = null;
    const returnFocus = hubState.profilePreviewReturnFocus;
    hubState.profilePreviewReturnFocus = null;
    restoreBackgroundModals(hubState.profilePreviewBackgroundModals);
    hubState.profilePreviewBackgroundModals = [];
    if(restoreFocus && returnFocus?.isConnected) returnFocus.focus();
  }

  function renderSchoolmateProfile(profile=hubState.profilePreview){
    if(!profile) return;
    const label = identityLabel(profile.display_name, profile.username);
    applyAvatarImage(
      $("schoolmateProfileAvatar"),
      $("schoolmateProfileInitials"),
      profile.display_name || profile.username,
      profile.avatar_path,
      profile.avatar_revision
    );
    $("schoolmateProfileName").textContent = label;
    $("schoolmateProfileMeta").textContent = [profile.major_of_study, profile.degree_level ? t(`${profile.degree_level}Degree`) : "", profile.study_year ? t(`studyYear${profile.study_year}`) : ""].filter(Boolean).join(" · ");
    $("schoolmateProfileBio").textContent = profile.bio || t("notProvided");
    const interests = $("schoolmateProfileInterests");
    interests.replaceChildren();
    (Array.isArray(profile.interests) ? profile.interests : []).forEach(item => interests.append(node("span", "", item)));
    const connections = $("schoolmateProfileConnections");
    connections.replaceChildren();
    const connectedProviders = [...new Set(Array.isArray(profile.connected_providers) ? profile.connected_providers : [])]
      .filter(provider => !!SOCIAL_PROVIDERS[provider]);
    connectedProviders.forEach(provider => {
      const config = SOCIAL_PROVIDERS[provider];
      const badge = node("span", "hub-profile-connection-badge", t("providerConnected", {provider:config.label}));
      badge.dataset.provider = provider;
      badge.dataset.mark = config.mark;
      connections.append(badge);
    });
    $("schoolmateProfileConnectionsSection").hidden = connectedProviders.length === 0;
    const links = $("schoolmateProfileLinks");
    links.replaceChildren();
    [["Instagram", profile.instagram_url], [t("linkedinProfileSelfReported"), profile.linkedin_url], [t("personalWebsite"), profile.website_url]].forEach(([name, href]) => {
      if(!href) return;
      try {
        const url = new URL(href);
        if(url.protocol !== "https:") return;
        const anchor = node("a", "", name);
        anchor.href = url.toString();
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        links.append(anchor);
      } catch(_error){}
    });
    if(profile.wechat_id){
      const wechatButton = node("button", "hub-profile-wechat-copy", `${t("wechatId")}: ${profile.wechat_id}`);
      wechatButton.type = "button";
      wechatButton.title = t("copyWechat");
      wechatButton.onclick = async () => {
        try {
          await navigator.clipboard.writeText(profile.wechat_id);
          wechatButton.textContent = t("wechatCopied");
          window.setTimeout(() => { if(wechatButton.isConnected) wechatButton.textContent = `${t("wechatId")}: ${profile.wechat_id}`; }, 1600);
        } catch(_error){
          wechatButton.textContent = profile.wechat_id;
        }
      };
      links.append(wechatButton);
    }
    $("schoolmateProfileLinksSection").hidden = !links.childElementCount;
    $("schoolmateProfileMessage").hidden = profile.user_id === currentUser?.id || !profile.username;
  }

  const socialProviderListFrom = value => [...new Set(Array.isArray(value) ? value : [])]
    .filter(provider => !!SOCIAL_PROVIDERS[provider]);

  async function loadSchoolmateConnectedProviders(userId){
    const response = await authClient.rpc("get_schoolmate_connected_providers", {p_user_id:userId});
    if(!response.error){
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      return {providers:socialProviderListFrom(row?.connected_providers), error:null};
    }
    const missingFunction = /Could not find the function|schema cache|does not exist|PGRST202/i.test(String(response.error?.message || ""));
    if(!missingFunction) return {providers:[], error:response.error};
    return {providers:[], error:null};
  }

  async function openSchoolmateProfile(userId, trigger=document.activeElement){
    if(!userId) return;
    const context = requestContext();
    const request = ++hubState.profilePreviewRequest;
    hubState.profilePreviewReturnFocus = trigger instanceof HTMLElement ? trigger : null;
    const [profileResponse, connectionResponse] = await Promise.all([
      authClient.rpc("get_schoolmate_profile", {p_user_id:userId}),
      loadSchoolmateConnectedProviders(userId)
    ]);
    if(!contextIsCurrent(context) || request !== hubState.profilePreviewRequest || !["community", "marketplace"].includes(hubState.activeView) || $("memberHub").hidden) return;
    const profile = Array.isArray(profileResponse.data) ? profileResponse.data[0] : profileResponse.data;
    if(profileResponse.error || !profile){
      const statusTarget = hubState.activeView === "marketplace" ? "marketplaceStatus" : "communityComposerStatus";
      setStatus(statusTarget, profileResponse.error ? featureError(profileResponse.error) : t("profileUnavailable"), "error");
      return;
    }
    profile.user_id = userId;
    profile.connected_providers = connectionResponse.error ? [] : connectionResponse.providers;
    if(connectionResponse.error) console.warn("Verified social connection badges are unavailable. Run the latest Supabase setup SQL.", connectionResponse.error);
    hubState.profilePreview = profile;
    renderSchoolmateProfile(profile);
    $("schoolmateProfileModal").hidden = false;
    hubState.profilePreviewBackgroundModals = suspendBackgroundModals($("schoolmateProfileModal"));
    $("closeSchoolmateProfile").focus();
  }

  async function messageProfileStudent(){
    const context = requestContext();
    const schoolmate = hubState.profilePreview;
    if(!schoolmate?.username || schoolmate.user_id === currentUser?.id) return;
    closeSchoolmateProfile({restoreFocus:false});
    await switchView("messages");
    if(!contextIsCurrent(context)) return;
    await startConversationWithSchoolmate(schoolmate);
  }

  async function togglePostLike(postId){
    const post = hubState.feed.find(item => item.post_id === postId);
    if(!post || hubState.likeBusy.has(postId)) return;
    hubState.likeBusy.add(postId);
    const wasLiked = post.liked_by_me === true;
    const previousCount = Number(post.like_count || 0);
    post.liked_by_me = !wasLiked;
    post.like_count = Math.max(0, previousCount + (wasLiked ? -1 : 1));
    const optimisticButton = document.querySelector(`[data-like-post="${postId}"]`);
    if(optimisticButton){
      optimisticButton.disabled = true;
      optimisticButton.textContent = `${post.liked_by_me ? t("unlike") : t("like")} · ${post.like_count}`;
      optimisticButton.classList.toggle("liked", post.liked_by_me);
      optimisticButton.setAttribute("aria-pressed", post.liked_by_me ? "true" : "false");
    }
    const context = requestContext();
    try {
      const { data, error } = await hubRpc("toggle_post_like", {p_post_id:postId});
      if(!contextIsCurrent(context)) return;
      if(error){
        post.liked_by_me = wasLiked;
        post.like_count = previousCount;
        setStatus("communityComposerStatus", featureError(error), "error");
      } else {
        post.liked_by_me = data === true;
        post.like_count = Math.max(0, previousCount + (post.liked_by_me ? 1 : 0) - (wasLiked ? 1 : 0));
      }
      const button = document.querySelector(`[data-like-post="${postId}"]`);
      if(button){
        button.textContent = `${post.liked_by_me ? t("unlike") : t("like")} · ${post.like_count}`;
        button.classList.toggle("liked", post.liked_by_me);
        button.setAttribute("aria-pressed", post.liked_by_me ? "true" : "false");
      }
    } catch(requestError){
      if(contextIsCurrent(context)){
        post.liked_by_me = wasLiked;
        post.like_count = previousCount;
        setStatus("communityComposerStatus", featureError(requestError), "error");
        const button = document.querySelector(`[data-like-post="${postId}"]`);
        if(button){
          button.textContent = `${post.liked_by_me ? t("unlike") : t("like")} · ${post.like_count}`;
          button.classList.toggle("liked", post.liked_by_me);
          button.setAttribute("aria-pressed", post.liked_by_me ? "true" : "false");
        }
      }
    } finally {
      if(contextIsCurrent(context)){
        hubState.likeBusy.delete(postId);
        const button = document.querySelector(`[data-like-post="${postId}"]`);
        if(button) button.disabled = false;
      }
    }
  }

  async function toggleCommunityCommentLike(comment, button){
    if(!comment?.comment_id || !button || button.disabled) return;
    const wasLiked = comment.liked_by_me === true;
    const previousCount = Math.max(0, Number(comment.like_count || 0));
    const context = requestContext();
    button.disabled = true;
    try {
      const response = await hubRpc("toggle_community_comment_like", {
        p_comment_id:comment.comment_id
      });
      if(!contextIsCurrent(context) || !button.isConnected) return;
      if(response.error){
        setStatus("communityComposerStatus", featureError(response.error), "error");
        return;
      }
      const result = parseJsonValue(response.data, response.data) || {};
      comment.liked_by_me = result === true || result.liked === true || result.liked_by_me === true;
      comment.like_count = Math.max(
        0,
        Number(
          result.like_count
          ?? previousCount + Number(comment.liked_by_me) - Number(wasLiked)
        )
      );
      button.textContent = `${t(comment.liked_by_me ? "commentUnlike" : "commentLike")} · ${comment.like_count}`;
      button.classList.toggle("liked", comment.liked_by_me);
      button.setAttribute("aria-pressed", comment.liked_by_me ? "true" : "false");
    } catch(requestError){
      if(contextIsCurrent(context)){
        setStatus("communityComposerStatus", featureError(requestError), "error");
      }
    } finally {
      if(contextIsCurrent(context) && button.isConnected) button.disabled = false;
    }
  }

  async function reportComment(commentId){
    const reason = await requestHubAction({title:t("report"), message:t("reportReasonPrompt"), input:true, confirmLabel:t("report"), danger:true});
    if(!reason) return;
    const context = requestContext();
    const { error } = await authClient.rpc("report_community_comment", {
      p_comment_id:commentId,
      p_reason:reason.trim()
    });
    if(!contextIsCurrent(context)) return;
    setStatus("communityComposerStatus", error ? featureError(error) : t("reported"), error ? "error" : "success");
  }

  async function deleteComment(commentId, container){
    const confirmed = await requestHubAction({title:t("deleteComment"), message:t("confirmDeleteComment"), confirmLabel:t("deleteComment"), danger:true});
    if(!confirmed) return;
    const context = requestContext();
    const { error } = await authClient.rpc("delete_community_comment", {p_comment_id:commentId});
    if(!contextIsCurrent(context) || !container.isConnected) return;
    if(error){ setStatus("communityComposerStatus", featureError(error), "error"); return; }
    setStatus("communityComposerStatus", t("commentDeleted"), "success");
    await loadCommunityFeed({force:true});
  }

  async function requestPostCommentPage(postId, cursor=null){
    const beforeCreatedAt = messageCursorValue(cursor, "before_created_at", "created_at", "next_before_created_at");
    const beforeId = messageCursorValue(cursor, "before_id", "id", "comment_id", "next_before_id");
    let response = await hubRpc("get_post_comments_page", {
      p_post_id:postId,
      p_limit:COMMUNITY_COMMENT_PAGE_SIZE,
      p_before_created_at:beforeCreatedAt,
      p_before_id:beforeId
    });
    if(!response.error){
      const payload = parseJsonValue(response.data, response.data) || {};
      return {
        items:Array.isArray(payload.items) ? payload.items : [],
        totalCount:Math.max(0, Number(payload.total_count || 0)),
        hasMore:payload.has_more === true,
        nextCursor:parseJsonValue(payload.next_cursor, payload.next_cursor) || null,
        error:null
      };
    }
    if(!missingRpcError(response.error)){
      return {items:[], totalCount:0, hasMore:false, nextCursor:null, error:response.error};
    }
    response = await hubRpc("get_post_comments", {p_post_id:postId});
    const rows = Array.isArray(response.data) ? response.data : [];
    return {
      items:rows,
      totalCount:rows.length,
      hasMore:false,
      nextCursor:null,
      error:response.error || null
    };
  }

  function mergeCommentRows(existing, incoming){
    const unique = new Map();
    [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]
      .forEach(comment => {
        const key = comment?.comment_id || comment?.id;
        if(key) unique.set(key, comment);
      });
    return [...unique.values()];
  }

  async function loadPostComments(postId, container, {append=false, force=false}={}){
    const context = requestContext();
    let pageState = hubState.postCommentPages.get(postId) || {
      items:[],
      totalCount:0,
      hasMore:false,
      nextCursor:null,
      loading:false,
      error:""
    };
    if(force){
      pageState = {...pageState, items:[], totalCount:0, hasMore:false, nextCursor:null, error:""};
    }
    if(pageState.loading) return;
    pageState.loading = true;
    hubState.postCommentPages.set(postId, pageState);
    if(!append || !pageState.items.length){
      container.replaceChildren(node("div", "hub-comment", t("loading")));
    }
    let page;
    try {
      page = await requestPostCommentPage(postId, append ? pageState.nextCursor : null);
    } catch(requestError){
      page = {items:[], totalCount:pageState.totalCount, hasMore:pageState.hasMore, nextCursor:pageState.nextCursor, error:requestError};
    }
    pageState.loading = false;
    if(!contextIsCurrent(context) || !container.isConnected) return;
    if(page.error){
      pageState.error = missingRpcError(page.error) ? t("memberSetupRequired") : t("commentsUnavailable");
    } else {
      pageState.error = "";
      pageState.items = append
        ? mergeCommentRows(page.items, pageState.items)
        : mergeCommentRows([], page.items);
      pageState.totalCount = Math.max(pageState.items.length, Number(page.totalCount || 0));
      pageState.hasMore = page.hasMore;
      pageState.nextCursor = page.nextCursor;
      const feedPost = hubState.feed.find(post => post.post_id === postId);
      if(feedPost && Number.isFinite(pageState.totalCount)){
        feedPost.comment_count = pageState.totalCount;
        const toggle = document.querySelector(`[data-post-id="${postId}"] .hub-post-action--comment`);
        if(toggle) toggle.textContent = `${t("comment")} · ${pageState.totalCount}`;
      }
    }
    hubState.postCommentPages.set(postId, pageState);
    container.replaceChildren();
    if(pageState.error){
      const loadStatus = node("p", "hub-comment-status error", pageState.error);
      loadStatus.setAttribute("role", "status");
      container.append(loadStatus);
    }
    const commentRows = pageState.items;
    if(!pageState.error && !commentRows.length){
      container.append(node("p", "hub-comment-status hub-comment-empty", t("commentsEmpty")));
    }
    let replyTarget = null;
    let replyContext = null;
    let replyContextLabel = null;
    let input = null;
    const syncReplyContext = ({focus=false}={}) => {
      if(!replyContext || !replyContextLabel || !input) return;
      replyContext.hidden = !replyTarget;
      replyContextLabel.textContent = replyTarget
        ? t("replyingTo", {username:replyTarget.author})
        : "";
      input.placeholder = replyTarget
        ? t("replyingTo", {username:replyTarget.author})
        : t("writeComment");
      if(focus) input.focus();
    };
    commentRows.forEach(comment => {
      const isReply = !!comment.parent_comment_id;
      const item = node("div", `hub-comment${isReply ? " is-reply" : ""}`);
      item.dataset.commentId = comment.comment_id;
      const copy = node("div", "hub-comment-copy");
      copy.append(node("b", "", identityLabel(comment.display_name, comment.author_username)));
      if(hubState.feedScope === "cross" && comment.school_name){
        copy.append(node("small", "hub-comment-school", comment.school_name));
      }
      if(isReply && (comment.parent_author_display_name || comment.parent_display_name || comment.parent_author_username)){
        copy.append(node(
          "small",
          "hub-comment-reply-label",
          t("replyingTo", {
            username:identityLabel(
              comment.parent_author_display_name || comment.parent_display_name,
              comment.parent_author_username
            )
          })
        ));
      }
      copy.append(node("span", "", comment.body || ""), node("time", "", formatCompactDate(comment.created_at)));
      const actions = node("div", "hub-comment-actions");
      const liked = comment.liked_by_me === true;
      const likeButton = node(
        "button",
        `hub-comment-action hub-comment-like${liked ? " liked" : ""}`,
        `${t(liked ? "commentUnlike" : "commentLike")} · ${Math.max(0, Number(comment.like_count || 0))}`
      );
      likeButton.type = "button";
      likeButton.setAttribute("aria-pressed", liked ? "true" : "false");
      likeButton.onclick = () => void toggleCommunityCommentLike(comment, likeButton);
      actions.append(likeButton);
      if(!isReply){
        const replyButton = node("button", "hub-comment-action hub-comment-reply", t("reply"));
        replyButton.type = "button";
        replyButton.onclick = () => {
          replyTarget = {
            commentId:comment.comment_id,
            author:identityLabel(comment.display_name, comment.author_username)
          };
          syncReplyContext({focus:true});
        };
        actions.append(replyButton);
      }
      if(hubState.feedScope !== "cross"){
        const profileButton = node("button", "", t("viewProfile"));
        profileButton.type = "button";
        profileButton.onclick = event => openSchoolmateProfile(comment.author_id, event.currentTarget);
        actions.append(profileButton);
      }
      if(comment.author_id === currentUser?.id){
        const deleteButton = node("button", "", t("deleteComment"));
        deleteButton.type = "button";
        deleteButton.onclick = () => deleteComment(comment.comment_id, container);
        actions.append(deleteButton);
      } else {
        const reportButton = node("button", "", t("report"));
        reportButton.type = "button";
        reportButton.onclick = () => reportComment(comment.comment_id);
        const blockButton = node("button", "", t("block"));
        blockButton.type = "button";
        blockButton.onclick = () => blockPostAuthor(comment);
        actions.append(reportButton, blockButton);
      }
      item.append(copy, actions);
      container.append(item);
    });
    if(commentRows.length){
      const pagination = node("div", "hub-comment-pagination");
      pagination.append(node(
        "span",
        "",
        communitySeedText({
          en:`Showing ${commentRows.length} of ${Math.max(commentRows.length, pageState.totalCount)} comments`,
          "zh-CN":`已显示 ${commentRows.length} / ${Math.max(commentRows.length, pageState.totalCount)} 条评论`,
          "zh-HK":`已顯示 ${commentRows.length} / ${Math.max(commentRows.length, pageState.totalCount)} 則留言`
        })
      ));
      if(pageState.hasMore && pageState.nextCursor){
        const loadMore = node(
          "button",
          "hub-comment-load-more",
          communitySeedText({en:"Load More Comments", "zh-CN":"加载更多评论", "zh-HK":"載入更多留言"})
        );
        loadMore.type = "button";
        loadMore.onclick = () => {
          loadMore.disabled = true;
          loadMore.textContent = communitySeedText({en:"Loading…", "zh-CN":"正在加载…", "zh-HK":"正在載入…"});
          void loadPostComments(postId, container, {append:true});
        };
        pagination.append(loadMore);
      }
      container.append(pagination);
    }
    const form = node("form", "hub-comment-form");
    form.noValidate = true;
    replyContext = node("div", "hub-comment-reply-context");
    replyContextLabel = node("span");
    const cancelReply = node("button", "hub-comment-reply-cancel", t("cancelReply"));
    cancelReply.type = "button";
    cancelReply.onclick = () => {
      replyTarget = null;
      syncReplyContext({focus:true});
    };
    replyContext.append(replyContextLabel, cancelReply);
    replyContext.hidden = true;
    input = node("input");
    input.type = "text";
    input.name = "comment";
    input.maxLength = 1000;
    input.autocomplete = "off";
    input.placeholder = t("writeComment");
    input.setAttribute("aria-label", t("writeComment"));
    const button = node("button", "btn-primary", t("postComment"));
    button.type = "submit";
    const submitStatus = node("p", "hub-comment-status");
    submitStatus.setAttribute("role", "status");
    submitStatus.setAttribute("aria-live", "polite");
    form.onsubmit = async event => {
      event.preventDefault();
      const commentContext = requestContext();
      const body = input.value.trim();
      if(!body){ input.setCustomValidity(t("commentRequired")); input.reportValidity(); input.setCustomValidity(""); return; }
      button.disabled = true;
      input.disabled = true;
      submitStatus.className = "hub-comment-status";
      submitStatus.textContent = t("commentPosting");
      try {
        const response = await hubRpc("add_post_comment", {
          p_post_id:postId,
          p_body:body,
          p_parent_comment_id:replyTarget?.commentId || null
        });
        if(!contextIsCurrent(commentContext) || !container.isConnected) return;
        if(response.error){
          submitStatus.className = "hub-comment-status error";
          submitStatus.textContent = missingRpcError(response.error) ? t("memberSetupRequired") : featureError(response.error);
          return;
        }
        input.value = "";
        submitStatus.className = "hub-comment-status success";
        submitStatus.textContent = t("commentPosted");
        const feedPost = hubState.feed.find(post => post.post_id === postId);
        if(feedPost){
          feedPost.comment_count = Number(feedPost.comment_count || 0) + 1;
          const toggle = document.querySelector(`[data-post-id="${postId}"] .hub-post-actions > button[aria-expanded]`);
          if(toggle) toggle.textContent = `${t("comment")} · ${feedPost.comment_count}`;
        }
        await loadPostComments(postId, container, {force:true});
      } catch(requestError){
        if(contextIsCurrent(commentContext) && container.isConnected){
          submitStatus.className = "hub-comment-status error";
          submitStatus.textContent = featureError(requestError);
        }
      } finally {
        if(contextIsCurrent(commentContext) && container.isConnected){
          button.disabled = false;
          input.disabled = false;
        }
      }
    };
    input.addEventListener("keydown", event => {
      if(event.key === "Enter" && !event.shiftKey && !event.isComposing){
        event.preventDefault();
        form.requestSubmit();
      }
    });
    form.append(replyContext, input, button, submitStatus);
    container.append(form);
  }

  async function reportPost(postId){
    const reason = await requestHubAction({title:t("report"), message:t("reportReasonPrompt"), input:true, confirmLabel:t("report"), danger:true});
    if(!reason) return;
    const cleanReason = reason.trim();
    const context = requestContext();
    const { error } = await authClient.rpc("report_community_post", {p_post_id:postId, p_reason:cleanReason});
    if(!contextIsCurrent(context)) return;
    setStatus("communityComposerStatus", error ? featureError(error) : t("reported"), error ? "error" : "success");
  }

  async function deletePost(postId){
    const confirmed = await requestHubAction({title:t("deletePost"), message:t("confirmDeletePost"), confirmLabel:t("deletePost"), danger:true});
    if(!confirmed) return;
    const post = hubState.feed.find(item => item.post_id === postId);
    const mediaPaths = (parseJsonValue(post?.media, []) || []).map(item => item?.storage_path).filter(Boolean);
    const context = requestContext();
    const { error } = await authClient.rpc("delete_community_post", {p_post_id:postId});
    if(error){
      // If the response was lost after the server committed, these objects are now
      // orphaned and removable. If the post is still live, Storage policy denies it.
      await removeCommunityUploads(mediaPaths);
      if(contextIsCurrent(context)) setStatus("communityComposerStatus", featureError(error), "error");
      return;
    }
    await removeCommunityUploads(mediaPaths);
    if(!contextIsCurrent(context)) return;
    setStatus("communityComposerStatus", t("postDeleted"), "success");
    await loadCommunityFeed({force:true});
  }

  async function blockPostAuthor(post){
    if(!post.author_id) return;
    const confirmed = await requestHubAction({title:t("block"), message:t("confirmBlock", {username:post.author_username || t("anonymousStudent")}), confirmLabel:t("block"), danger:true});
    if(!confirmed) return;
    const context = requestContext();
    const { error } = await authClient.rpc("block_community_user", {p_user_id:post.author_id});
    if(!contextIsCurrent(context)) return;
    if(error){ setStatus("communityComposerStatus", featureError(error), "error"); return; }
    setStatus("communityComposerStatus", t("blocked"), "success");
    await loadCommunityFeed({force:true});
  }

  function unloadRenderedCommunityMedia(){
    const feed = $("communityFeed");
    if(!feed) return null;
    feed.querySelectorAll(".hub-post-media-item").forEach(holder => {
      if(typeof holder._unloadCommunityMedia === "function") holder._unloadCommunityMedia();
    });
    communityMediaObserver?.disconnect();
    return feed;
  }

  function replaceCommunityFeed(...content){
    const feed = unloadRenderedCommunityMedia();
    if(feed) feed.replaceChildren(...content);
    return feed;
  }

  function communityMediaItems(post){
    const media = parseJsonValue(post?.media, []);
    return Array.isArray(media) ? media.filter(item => item?.storage_path) : [];
  }

  function communityPopularityScore(post){
    const engagement = Number(post?.like_count || 0) * 2 + Number(post?.comment_count || 0) * 3;
    const ageHours = Math.max(0, (Date.now() - new Date(post?.created_at || 0).getTime()) / 3_600_000);
    return (engagement + 1) / (1 + ageHours / 48);
  }

  function communitySeedText(value){
    if(typeof value === "string") return value;
    return value?.[currentLanguage] || value?.en || "";
  }

  function communitySeedPostState(key){
    if(!hubState.communitySeedState.has(key)){
      hubState.communitySeedState.set(key, {
        liked:false,
        saved:false,
        selectedPoll:-1,
        commentsOpen:false,
        commentLikes:new Set(),
        replyTarget:null,
        nextCommentId:0,
        comments:[],
        status:""
      });
    }
    return hubState.communitySeedState.get(key);
  }

  async function shareCommunitySeedPost(seed, state){
    const body = communitySeedText(seed.body);
    const shareData = {title:`${seed.author} · ConCourse`, text:body, url:window.location.href};
    if(navigator.share){
      try {
        await navigator.share(shareData);
        return;
      } catch(error){
        if(error?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${seed.author}\n${body}\n${window.location.href}`);
      state.status = t("postLinkCopied");
    } catch(_error){
      state.status = t("shareFailed");
    }
    renderCommunityFeed(hubState.feed);
  }

  function communitySeedAvatar(seed, extraClass=""){
    const avatar = node("div", `hub-avatar hub-community-example-avatar${extraClass ? ` ${extraClass}` : ""}`, seed.initials);
    avatar.setAttribute("aria-hidden", "true");
    if(seed.avatar?.src){
      const image = node("img", "hub-community-example-avatar-image");
      image.src = seed.avatar.src;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.style.objectPosition = seed.avatar.position || "center";
      avatar.append(image);
    }
    return avatar;
  }

  function communitySeedCommentRow(comment, {
    own=false,
    commentKey="",
    state=null,
    onReply=null
  }={}){
    const localComment = own && comment && typeof comment === "object"
      ? comment
      : null;
    const author = own
      ? communitySeedText({en:"You", "zh-CN":"你", "zh-HK":"你"})
      : String(comment?.author || t("anonymousStudent"));
    const body = own
      ? String(localComment?.body || comment || "")
      : communitySeedText(comment?.body || comment);
    const time = own
      ? communitySeedText({en:"now", "zh-CN":"刚刚", "zh-HK":"啱啱"})
      : communitySeedText(comment?.time || "");
    const parentKey = String(localComment?.parentKey || "");
    const parentAuthor = String(localComment?.parentAuthor || "");
    const liked = !!state?.commentLikes?.has(commentKey);
    const baseLikeCount = Math.max(0, Number(comment?.likeCount || 0));
    const row = node(
      "article",
      `hub-community-example-comment${parentKey ? " is-reply" : ""}`
    );
    const avatar = node("span", "hub-community-example-comment-avatar", initialsFor(author));
    avatar.setAttribute("aria-hidden", "true");
    const copy = node("div");
    const heading = node("p");
    heading.append(node("b", "", author));
    if(time) heading.append(node("time", "", time));
    copy.append(heading);
    if(parentAuthor){
      copy.append(node("small", "hub-comment-reply-label", t("replyingTo", {username:parentAuthor})));
    }
    copy.append(node("span", "", body));
    const actions = node("div", "hub-community-example-comment-actions");
    const like = node(
      "button",
      `hub-comment-action hub-comment-like${liked ? " liked" : ""}`,
      `${t(liked ? "commentUnlike" : "commentLike")} · ${baseLikeCount + Number(liked)}`
    );
    like.type = "button";
    like.setAttribute("aria-pressed", liked ? "true" : "false");
    like.onclick = () => {
      if(!state) return;
      if(liked) state.commentLikes.delete(commentKey);
      else state.commentLikes.add(commentKey);
      state.status = "";
      renderCommunityFeed(hubState.feed);
    };
    actions.append(like);
    if(!parentKey){
      const reply = node("button", "hub-comment-action hub-comment-reply", t("reply"));
      reply.type = "button";
      reply.onclick = () => {
        if(typeof onReply === "function") onReply({
          commentKey,
          author
        });
      };
      actions.append(reply);
    }
    copy.append(actions);
    row.append(avatar, copy);
    return row;
  }

  function renderCommunitySeedPosts(feed){
    const collection = node("section", "hub-community-example hub-community-seed-feed");
    collection.setAttribute("aria-label", t("campusFeed"));
    const disclosure = node(
      "p",
      "hub-community-seed-disclosure",
      communitySeedText({
        en:"ConCourse Starter Posts · Curated to show how Community works",
        "zh-CN":"ConCourse 入门帖子 · 用于展示社区功能",
        "zh-HK":"ConCourse 入門帖文 · 用嚟展示校園社群功能"
      })
    );
    disclosure.setAttribute("role", "note");
    collection.append(disclosure);

    COMMUNITY_SEED_POSTS.forEach(seed => {
      const state = communitySeedPostState(seed.key);
      const post = node("article", "hub-post-card hub-post-card--media hub-post-card--seed");
      post.dataset.communitySeed = seed.key;
      const focusCommentInput = () => {
        requestAnimationFrame(() => {
          document
            .querySelector(`[data-community-seed="${seed.key}"] .hub-community-example-comment-input`)
            ?.focus();
        });
      };
      const setReplyTarget = target => {
        state.commentsOpen = true;
        state.replyTarget = target;
        state.status = "";
        renderCommunityFeed(hubState.feed);
        focusCommentInput();
      };

      const author = node("div", "hub-post-author");
      const avatar = communitySeedAvatar(seed);
      const authorCopy = node("div");
      authorCopy.append(
        node("b", "", seed.author),
        node("span", "", communitySeedText(seed.meta))
      );
      author.append(avatar, authorCopy);
      post.append(author);

      const media = node("figure", "hub-community-seed-media");
      const image = node("img");
      image.src = seed.image;
      image.width = 1200;
      image.height = 900;
      image.loading = "lazy";
      image.decoding = "async";
      image.alt = communitySeedText(seed.imageAlt);
      media.append(image);
      post.append(media, node("p", "hub-post-body", communitySeedText(seed.body)));

      const tags = node("div", "hub-post-tags");
      seed.tags.forEach(tag => tags.append(node("span", "hub-post-tag", `#${tag}`)));
      post.append(tags);

      if(seed.poll){
        const poll = node("section", "hub-post-poll hub-community-example-poll");
        poll.append(node("h3", "", communitySeedText(seed.poll.question)));
        const totalVotes = seed.poll.options.reduce(
          (sum, option, index) => sum + option.votes + (state.selectedPoll === index ? 1 : 0),
          0
        );
        seed.poll.options.forEach((option, index) => {
          const votes = option.votes + (state.selectedPoll === index ? 1 : 0);
          const share = Math.round((votes / totalVotes) * 100);
          const label = communitySeedText(option.label);
          const button = node("button", `hub-community-example-option${state.selectedPoll === index ? " selected" : ""}`);
          button.type = "button";
          button.setAttribute("aria-pressed", state.selectedPoll === index ? "true" : "false");
          button.setAttribute("aria-label", `${label}: ${share}%`);
          const copy = node("span");
          copy.append(node("b", "", label), node("small", "", `${share}%`));
          const track = node("i");
          track.style.setProperty("--community-example-share", `${share}%`);
          button.append(copy, track);
          button.onclick = () => {
            state.selectedPoll = index;
            state.status = t("communityExampleVoteRecorded");
            renderCommunityFeed(hubState.feed);
          };
          poll.append(button);
        });
        post.append(poll);
      }

      const actions = node("div", "hub-post-actions hub-community-example-actions");
      const like = node(
        "button",
        `hub-post-action hub-post-action--like${state.liked ? " liked" : ""}`,
        `${state.liked ? t("unlike") : t("like")} · ${seed.likeCount + Number(state.liked)}`
      );
      like.type = "button";
      like.setAttribute("aria-pressed", state.liked ? "true" : "false");
      like.onclick = () => {
        state.liked = !state.liked;
        state.status = "";
        renderCommunityFeed(hubState.feed);
      };
      const comments = node(
        "button",
        "hub-post-action hub-post-action--comment",
        `${t("comment")} · ${seed.comments.length + state.comments.length}`
      );
      comments.type = "button";
      comments.setAttribute("aria-expanded", state.commentsOpen ? "true" : "false");
      comments.onclick = () => {
        state.commentsOpen = !state.commentsOpen;
        state.replyTarget = null;
        state.status = "";
        renderCommunityFeed(hubState.feed);
        if(state.commentsOpen) focusCommentInput();
      };
      const save = node(
        "button",
        `hub-post-action hub-post-action--save${state.saved ? " bookmarked" : ""}`,
        state.saved ? t("postSaved") : t("savePost")
      );
      save.type = "button";
      save.setAttribute("aria-pressed", state.saved ? "true" : "false");
      save.onclick = () => {
        state.saved = !state.saved;
        state.status = "";
        renderCommunityFeed(hubState.feed);
      };
      const share = node("button", "hub-post-action hub-post-action--share", t("share"));
      share.type = "button";
      share.onclick = () => void shareCommunitySeedPost(seed, state);
      actions.append(like, comments, save, share);
      post.append(actions);

      const commentArea = node("div", "hub-community-example-comments");
      const commentList = node("div", "hub-community-example-comment-list");
      commentList.setAttribute("role", "feed");
      commentList.setAttribute("aria-label", `${t("comment")} · ${seed.comments.length + state.comments.length}`);
      seed.comments.forEach((comment, index) => {
        commentList.append(communitySeedCommentRow(comment, {
          commentKey:`${seed.key}:seed:${index}`,
          state,
          onReply:setReplyTarget
        }));
      });
      state.comments.forEach(comment => {
        commentList.append(communitySeedCommentRow(comment, {
          own:true,
          commentKey:`${seed.key}:local:${comment.id}`,
          state,
          onReply:setReplyTarget
        }));
      });
      commentArea.append(commentList);
      const form = node("div", "hub-community-example-comment-form");
      if(state.replyTarget){
        const replyContext = node("div", "hub-comment-reply-context");
        replyContext.append(
          node("span", "", t("replyingTo", {username:state.replyTarget.author})),
          (() => {
            const cancel = node("button", "hub-comment-reply-cancel", t("cancelReply"));
            cancel.type = "button";
            cancel.onclick = () => {
              state.replyTarget = null;
              state.status = "";
              renderCommunityFeed(hubState.feed);
              focusCommentInput();
            };
            return cancel;
          })()
        );
        form.append(replyContext);
      }
      const input = node("input", "hub-community-example-comment-input");
      input.maxLength = 240;
      input.placeholder = t("writeComment");
      input.setAttribute("aria-label", t("writeComment"));
      const submit = node("button", "", t("postComment"));
      submit.type = "button";
      const addComment = () => {
        const value = input.value.trim();
        if(!value) return;
        state.nextCommentId += 1;
        state.comments.push({
          id:state.nextCommentId,
          body:value,
          parentKey:state.replyTarget?.commentKey || "",
          parentAuthor:state.replyTarget?.author || ""
        });
        state.commentsOpen = true;
        state.replyTarget = null;
        state.status = t("commentPosted");
        renderCommunityFeed(hubState.feed);
      };
      submit.onclick = addComment;
      input.addEventListener("keydown", event => {
        if(event.key === "Enter" && !event.isComposing){
          event.preventDefault();
          addComment();
        }
      });
      form.append(input, submit);
      commentArea.append(form);
      if(state.status) commentArea.append(node("small", "hub-community-example-status", state.status));
      commentArea.hidden = !state.commentsOpen;
      post.append(commentArea);
      collection.append(post);
    });
    feed.append(collection);
  }

  function renderCommunityFeed(posts){
    const feed = replaceCommunityFeed();
    if(!feed) return;
    updateCommunityLoadMore();
    const showSeedPosts = communitySeedAvailable();
    if(hubState.communityFeedError){
      const errorNotice = node("div", "hub-feed-error", hubState.communityFeedError);
      errorNotice.setAttribute("role", "alert");
      feed.append(errorNotice);
    }
    if(!posts.length){
      if(showSeedPosts) renderCommunitySeedPosts(feed);
      else feed.append(node("div", "hub-feed-empty", t(hubState.feedScope === "cross" ? "crossCommunityEmpty" : "communityEmpty")));
      return;
    }
    const visiblePosts = filteredCommunityPosts(posts);
    if(!visiblePosts.length){ feed.append(node("div", "hub-feed-empty", t("communityNoMatches"))); return; }
    const featuredPost = visiblePosts
      .filter(post => communityMediaItems(post).some(item => item.media_type !== "video"))
      .sort((left, right) => communityPopularityScore(right) - communityPopularityScore(left))[0] || null;
    const orderedPosts = featuredPost
      ? [featuredPost, ...visiblePosts.filter(post => post.post_id !== featuredPost.post_id)]
      : visiblePosts;
    orderedPosts.forEach(post => {
      const mediaItems = communityMediaItems(post);
      const featured = post.post_id === featuredPost?.post_id;
      const card = node("article", `hub-post-card${mediaItems.length ? " hub-post-card--media" : " hub-post-card--text"}${featured ? " hub-post-card--featured" : ""}`);
      card.id = `post-${post.post_id}`;
      card.dataset.postId = post.post_id;
      if(featured) card.append(node("span", "hub-post-popular-label", t(hubState.feedScope === "cross" ? "popularAcrossCampuses" : "popularOnCampus")));
      const author = node("div", "hub-post-author");
      const authorName = postAuthorName(post);
      const avatar = createAvatar(post.display_name || post.author_username, post.avatar_path, post.avatar_revision);
      const authorCopy = node("div");
      authorCopy.append(node("b", "", authorName), node("span", "", [post.school_name, post.major_of_study, formatCompactDate(post.created_at)].filter(Boolean).join(" · ")));
      const crossCampus = hubState.feedScope === "cross";
      const authorButton = node(crossCampus ? "div" : "button", `hub-post-author-button${crossCampus ? " cross-campus" : ""}`);
      if(!crossCampus) authorButton.type = "button";
      authorButton.append(avatar, authorCopy);
      if(!crossCampus) authorButton.onclick = event => openSchoolmateProfile(post.author_id, event.currentTarget);
      author.append(authorButton);
      card.append(author);

      const media = renderPostMedia(post);
      if(media) card.append(media);
      if(post.body) card.append(node("div", "hub-post-body", post.body));

      const tags = node("div", "hub-post-tags");
      (Array.isArray(post.tags) ? post.tags : []).forEach(tag => tags.append(node("span", "hub-post-tag", `#${tag}`)));
      if(tags.childElementCount) card.append(tags);

      const poll = renderPostPoll(post);
      if(poll) card.append(poll);
      const linkedListing = window.ConCourseMarketplace?.renderLinkedListing(post.linked_listing);
      if(linkedListing) card.append(linkedListing);

      const actions = node("div", "hub-post-actions");
      const commentButton = node("button", "hub-post-action hub-post-action--comment", `${t("comment")} · ${Number(post.comment_count || 0)}`);
      commentButton.type = "button";
      const comments = node("div", "hub-comments");
      let commentsVisible = hubState.openCommentPostIds.has(post.post_id);
      commentButton.setAttribute("aria-expanded", commentsVisible ? "true" : "false");
      commentButton.onclick = async () => {
        commentsVisible = !commentsVisible;
        if(commentsVisible) hubState.openCommentPostIds.add(post.post_id);
        else hubState.openCommentPostIds.delete(post.post_id);
        comments.hidden = !commentsVisible;
        commentButton.setAttribute("aria-expanded", commentsVisible ? "true" : "false");
        if(commentsVisible) await loadPostComments(post.post_id, comments);
      };
      const likeButton = node("button", `hub-post-action hub-post-action--like${post.liked_by_me ? " liked" : ""}`, `${post.liked_by_me ? t("unlike") : t("like")} · ${Number(post.like_count || 0)}`);
      likeButton.type = "button";
      likeButton.dataset.likePost = post.post_id;
      likeButton.disabled = hubState.likeBusy.has(post.post_id);
      likeButton.setAttribute("aria-pressed", post.liked_by_me ? "true" : "false");
      likeButton.onclick = () => togglePostLike(post.post_id);
      const bookmarkButton = node("button", `hub-post-action hub-post-action--save${post.bookmarked_by_me ? " bookmarked" : ""}`, post.bookmarked_by_me ? t("postSaved") : t("savePost"));
      bookmarkButton.type = "button";
      bookmarkButton.dataset.bookmarkPost = post.post_id;
      bookmarkButton.disabled = hubState.bookmarkBusy.has(post.post_id);
      bookmarkButton.setAttribute("aria-pressed", post.bookmarked_by_me ? "true" : "false");
      bookmarkButton.onclick = () => togglePostBookmark(post.post_id);
      const shareButton = node("button", "hub-post-action hub-post-action--share", t("share"));
      shareButton.type = "button";
      shareButton.onclick = () => shareCommunityPost(post.post_id);
      actions.append(commentButton, likeButton, bookmarkButton, shareButton);

      const menu = node("details", "hub-post-menu");
      const summary = node("summary", "", "•••");
      summary.setAttribute("aria-label", t("moreActions"));
      const menuList = node("div", "hub-post-menu-list");
      if(post.author_id === currentUser?.id){
        const deleteButton = node("button", "danger", t("deletePost"));
        deleteButton.type = "button";
        deleteButton.onclick = () => { menu.open = false; deletePost(post.post_id); };
        menuList.append(deleteButton);
      } else {
        const reportButton = node("button", "", t("report"));
        reportButton.type = "button";
        reportButton.onclick = () => { menu.open = false; reportPost(post.post_id); };
        const blockButton = node("button", "", t("block"));
        blockButton.type = "button";
        blockButton.onclick = () => { menu.open = false; blockPostAuthor(post); };
        menuList.append(reportButton, blockButton);
      }
      menu.append(summary, menuList);
      actions.append(menu);
      comments.hidden = !commentsVisible;
      card.append(actions, comments);
      feed.append(card);
      if(commentsVisible) void loadPostComments(post.post_id, comments);
    });
    if(showSeedPosts) renderCommunitySeedPosts(feed);
    const hashPostId = String(window.location.hash || "").replace(/^#(?:cross-)?post-/, "");
    if(hashPostId && hashPostId !== hubState.highlightedPostId){
      const target = document.getElementById(`post-${hashPostId}`);
      if(target){
        hubState.highlightedPostId = hashPostId;
        requestAnimationFrame(() => {
          target.classList.add("hub-post-highlight");
          target.scrollIntoView({behavior:"smooth", block:"center"});
          window.setTimeout(() => target.classList.remove("hub-post-highlight"), 2400);
        });
      }
    }
  }

  function updateCommunityLoadMore(){
    const button = $("communityLoadMore");
    if(!button) return;
    button.hidden = !hubState.feedHasMore || !hubState.feed.length;
    button.disabled = hubState.loadingFeed;
    button.textContent = t(hubState.loadingFeed ? "loadingMore" : "loadMore");
  }

  async function requestCommunityFeed(parameters, scope=hubState.feedScope){
    if(scope === "cross") return hubRpc("get_cross_school_feed", parameters);
    let response = await hubRpc("get_school_feed_v2", parameters);
    if(response.error && missingRpcError(response.error)){
      response = await hubRpc("get_school_feed", parameters);
    }
    return response;
  }

  async function loadCommunityFeed({force=false, append=false}={}){
    const canShowSeedPosts = !append && communitySeedAvailable();
    if(!authClient || !currentUser){
      if(canShowSeedPosts) renderCommunityFeed([]);
      return;
    }
    if(append && hubState.loadingFeed) return;
    const crossHash = /^#cross-post-/i.test(String(window.location.hash || ""));
    if(crossHash && !append && hubState.feedScope !== "cross"){
      hubState.feedScope = "cross";
      syncCommunityScopeControls();
    }
    let mode = communityFeedMode();
    if(!force && !append && hubState.feed.length && hubState.feedMode === mode){
      renderCommunityFeed(hubState.feed);
      return;
    }
    const context = requestContext();
    const request = ++hubState.feedRequest;
    const limit = COMMUNITY_FEED_PAGE_SIZE;
    const offset = append && hubState.feedMode === mode ? hubState.feedOffset : 0;
    hubState.loadingFeed = true;
    updateCommunityLoadMore();
    if(!append && (!hubState.feed.length || hubState.feedMode !== mode)){
      if(canShowSeedPosts) renderCommunityFeed([]);
      else replaceCommunityFeed(node("div", "hub-feed-empty", t(hubState.feedScope === "cross" ? "crossCommunityLoading" : "communityLoading")));
    }
    let data = null;
    let error = null;
    try {
      const response = await requestCommunityFeed({
        p_limit:limit,
        p_offset:offset,
        p_bookmarked_only:hubState.feedTopic === "saved",
        p_post_id:null
      });
      data = response.data;
      error = response.error;
    } catch(requestError){
      error = requestError;
    }
    if(!contextIsCurrent(context) || request !== hubState.feedRequest) return;
    hubState.loadingFeed = false;
    if(error){
      const message = featureError(error);
      hubState.communityFeedError = message;
      if(!append){
        hubState.feedMode = mode;
        hubState.feedHasMore = false;
        renderCommunityFeed(hubState.feed);
        setStatus("communityFeedStatus", message, "error");
      } else setStatus("communityComposerStatus", featureError(error), "error");
      updateCommunityLoadMore();
      return;
    }
    let rows = Array.isArray(data) ? data : [];
    const hashMatch = hubState.feedTopic !== "saved" && offset === 0
      ? String(window.location.hash || "").match(/^#(?:cross-)?post-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
      : null;
    const hashPostId = hashMatch?.[1] || "";
    if(hashPostId && !rows.some(post => post.post_id === hashPostId)){
      const requestedScope = hubState.feedScope;
      let targeted = {data:null, error:null};
      try {
        targeted = await requestCommunityFeed({
          p_limit:1,
          p_offset:0,
          p_bookmarked_only:false,
          p_post_id:hashPostId
        });
      } catch(requestError){
        targeted = {data:null, error:requestError};
      }
      if(!contextIsCurrent(context) || request !== hubState.feedRequest) return;
      if(!targeted.error && Array.isArray(targeted.data) && targeted.data.length){
        rows = [...rows, ...targeted.data];
      } else if(!targeted.error && Array.isArray(targeted.data)){
        // A shared post can be opened by both its home campus and the wider
        // verified network. If the link's original scope is not the viewer's
        // applicable scope, resolve it safely through the alternate feed RPC.
        const alternateScope = requestedScope === "cross" ? "school" : "cross";
        let alternate = {data:null, error:null};
        try {
          alternate = await requestCommunityFeed({
            p_limit:1,
            p_offset:0,
            p_bookmarked_only:false,
            p_post_id:hashPostId
          }, alternateScope);
        } catch(requestError){
          alternate = {data:null, error:requestError};
        }
        if(!contextIsCurrent(context) || request !== hubState.feedRequest) return;
        if(!alternate.error && Array.isArray(alternate.data) && alternate.data.length){
          hubState.feedScope = alternateScope;
          hubState.feed = [];
          hubState.feedOffset = 0;
          hubState.feedHasMore = false;
          syncCommunityScopeControls();
          syncCommunityTopicControls();
          mode = communityFeedMode();
          rows = alternate.data;
          data = alternate.data;
        }
      }
    }
    const base = append && hubState.feedMode === mode ? hubState.feed : [];
    const seen = new Set(base.map(post => post.post_id));
    const merged = [...base];
    rows.forEach(post => {
      if(!seen.has(post.post_id)){
        seen.add(post.post_id);
        merged.push(post);
      }
    });
    let windowed = merged;
    let scrollAnchor = null;
    if(append && merged.length > COMMUNITY_FEED_WINDOW){
      const trimCount = merged.length - COMMUNITY_FEED_WINDOW;
      const anchorId = merged[trimCount]?.post_id;
      const anchor = anchorId ? document.getElementById(`post-${anchorId}`) : null;
      if(anchor) scrollAnchor = {id:anchorId, top:anchor.getBoundingClientRect().top};
      windowed = merged.slice(trimCount);
    }
    hubState.feed = windowed;
    hubState.feedMode = mode;
    hubState.feedOffset = offset + (Array.isArray(data) ? data.length : 0);
    hubState.feedHasMore = (Array.isArray(data) ? data.length : 0) === limit;
    hubState.communityFeedError = "";
    renderCommunityFeed(hubState.feed);
    setStatus("communityFeedStatus", "");
    if(scrollAnchor){
      requestAnimationFrame(() => {
        const anchor = document.getElementById(`post-${scrollAnchor.id}`);
        if(anchor) window.scrollBy({top:anchor.getBoundingClientRect().top - scrollAnchor.top, left:0, behavior:"auto"});
      });
    }
  }

  async function publishCommunityPost(){
    if(hubState.feedScope === "cross" || hubState.composerMediaBusy || !currentUser) return;
    const linkedListingId = window.ConCourseMarketplace?.selectedCommunityListingId() || null;
    const typedBody = $("communityPostBody").value.trim();
    const body = typedBody || (linkedListingId ? t("marketplaceSharedPostDefault") : "");
    let poll;
    try { poll = communityPollPayload(); }
    catch(error){ setStatus("communityComposerStatus", error.message, "error"); return; }
    if(!body && !hubState.composerMedia.length && !poll){ setStatus("communityComposerStatus", t("postContentRequired"), "error"); return; }
    const tags = parseInterests($("communityPostTags").value).map(tag => tag.replace(/^#/, "").slice(0, 30)).filter(Boolean).slice(0, 6);
    const context = requestContext();
    const operation = ++hubState.publishOperation;
    const draftId = crypto.randomUUID();
    const crossCampusVisible = $("communityCrossCampus").checked;
    const mediaSnapshot = hubState.composerMedia.map(item => ({...item, altText:String(item.altText || "").trim()}));
    const pollSnapshot = poll ? {question:poll.question, options:[...poll.options]} : null;
    let uploaded = {paths:[], descriptors:[]};
    setCommunityComposerBusy(true);
    setStatus("communityComposerStatus", t("publishing"));
    try {
      uploaded = await uploadCommunityMedia(draftId, mediaSnapshot, context, operation);
      if(!contextIsCurrent(context) || operation !== hubState.publishOperation){ await removeCommunityUploads(uploaded.paths); return; }
      let response = await authClient.rpc("publish_community_post_v3", {
        p_body:body || null,
        p_tags:tags,
        p_media:uploaded.descriptors,
        p_poll_question:pollSnapshot?.question || null,
        p_poll_options:pollSnapshot?.options || [],
        p_listing_id:linkedListingId
      });
      if(response.error && !linkedListingId && missingRpcError(response.error)){
        response = await authClient.rpc("publish_community_post_v2", {
          p_body:body || null,
          p_tags:tags,
          p_media:uploaded.descriptors,
          p_poll_question:pollSnapshot?.question || null,
          p_poll_options:pollSnapshot?.options || []
        });
      }
      const {data:publishedPost, error} = response;
      if(error){
        await removeCommunityUploads(uploaded.paths);
        if(!contextIsCurrent(context) || operation !== hubState.publishOperation) return;
        setStatus("communityComposerStatus", featureError(error) || t("postPublishFailed"), "error");
        return;
      }
      if(!contextIsCurrent(context) || operation !== hubState.publishOperation) return;
      let crossCampusError = null;
      if(crossCampusVisible){
        const postId = Array.isArray(publishedPost) ? publishedPost[0]?.post_id || publishedPost[0]?.id : publishedPost;
        if(postId){
          try {
            const visibilityResponse = await hubRpc("set_community_post_cross_campus", {p_post_id:postId, p_visible:true});
            crossCampusError = visibilityResponse.error || null;
          } catch(visibilityRequestError){
            crossCampusError = visibilityRequestError;
          }
        } else crossCampusError = new Error("Published post identifier was unavailable");
      }
      if(!contextIsCurrent(context) || operation !== hubState.publishOperation) return;
      clearCommunityComposer();
      hubState.feedTopic = "all";
      syncCommunityTopicControls();
      setStatus(
        "communityComposerStatus",
        crossCampusError ? t("postPublishedCampusOnly") : t(crossCampusVisible ? "postPublishedAcrossCampuses" : "postPublished"),
        crossCampusError ? "error" : "success"
      );
      await loadCommunityFeed({force:true});
    } catch(error){
      await removeCommunityUploads(uploaded.paths);
      if(contextIsCurrent(context) && operation === hubState.publishOperation){
        const message = error?.mediaUpload ? mediaUploadError(error, {membershipRequired:true}) : featureError(error) || t("postPublishFailed");
        setStatus("communityComposerStatus", message, "error");
      }
    } finally {
      if(contextIsCurrent(context) && operation === hubState.publishOperation) setCommunityComposerBusy(false);
    }
  }

  function conversationContextLabel(conversation){
    if(conversation?.conversation_context !== "marketplace") return "";
    return [conversation.other_school_name, conversation.marketplace_listing_title]
      .map(value => String(value || "").trim())
      .filter(Boolean)
      .join(" · ");
  }

  function messageAvailabilityEnabled(){
    return hubState.profile?.allow_messages === true;
  }

  function renderMessageAvailability(){
    const toggle = $("messageAvailability");
    if(!toggle) return;
    const enabled = messageAvailabilityEnabled();
    const loading = !hubState.profileHydrated || hubState.profileLoading;
    toggle.checked = enabled;
    toggle.disabled = !currentUser || loading || hubState.messageAvailabilityUpdating;
    const row = toggle.closest(".hub-message-availability");
    row?.classList.toggle("is-enabled", enabled);
    row?.classList.toggle("is-busy", hubState.messageAvailabilityUpdating);
    const hint = $("messageAvailabilityHint");
    if(hint){
      hint.textContent = t(
        hubState.messageAvailabilityUpdating
          ? "messageAvailabilitySaving"
          : loading
            ? "messageAvailabilityLoading"
            : enabled
              ? "messageAvailabilityHintOn"
              : "messageAvailabilityHintOff"
      );
    }
  }

  async function setMessageAvailability(enabled){
    if(
      !authClient
      || !currentUser
      || hubState.messageAvailabilityUpdating
      || !hubState.profileHydrated
    ) return false;
    const context = requestContext();
    const previous = messageAvailabilityEnabled();
    hubState.messageAvailabilityUpdating = true;
    renderMessageAvailability();
    setStatus("chatStatus", t("messageAvailabilitySaving"));
    let response;
    try {
      response = await hubRpc("set_message_availability", {p_enabled:enabled});
      if(response.error && missingRpcError(response.error)){
        response = await authClient
          .from("member_profiles")
          .upsert(
            {user_id:context.userId, allow_messages:enabled},
            {onConflict:"user_id"}
          )
          .select("allow_messages")
          .single();
      }
    } catch(error){
      response = {error};
    }
    if(!contextIsCurrent(context)) return false;
    hubState.messageAvailabilityUpdating = false;
    if(response?.error){
      hubState.profile = {...(hubState.profile || {}), allow_messages:previous};
      renderMessageAvailability();
      setStatus(
        "chatStatus",
        featureError(response.error) || t("profileSaveFailed"),
        "error"
      );
      return false;
    }
    const saved = typeof response?.data === "boolean"
      ? response.data
      : response?.data?.allow_messages === true;
    hubState.profile = {...(hubState.profile || {}), allow_messages:saved};
    hubState.profileUserId = context.userId;
    $("profileAllowMessages").checked = saved;
    renderMessageAvailability();
    if(!saved && hubState.activeConversationId && !hubState.messageDemoMode){
      hubState.activeConversationCanSend = false;
      renderActiveConversationHeader();
      $("chatMessageInput").disabled = true;
      $("sendChatMessage").disabled = true;
    }
    if(hubState.activeView === "messages" && hubState.conversations.length){
      void loadConversations({force:true, suppressStatus:true});
    }
    if(saved){
      setStatus("chatStatus", t("messageAvailabilityEnabled"), "success");
      queueUsernameSearch();
    } else {
      clearUsernameSuggestions({cancel:true});
      setStatus("chatStatus", t("messageAvailabilityDisabled"));
    }
    return true;
  }

  function normalizedMessageUsername(value){
    return String(value || "").trim().replace(/^@+/, "");
  }

  function clearUsernameSuggestions({cancel=false}={}){
    if(cancel){
      if(hubState.usernameSearchTimer){
        window.clearTimeout(hubState.usernameSearchTimer);
      }
      hubState.usernameSearchTimer = 0;
      hubState.usernameSearchRequest += 1;
      hubState.usernameSearchLoading = false;
    }
    hubState.usernameSuggestions = [];
    hubState.usernameSuggestionIndex = -1;
    const list = $("chatUsernameSuggestions");
    list?.replaceChildren();
    if(list) list.hidden = true;
    const input = $("chatUsername");
    input?.setAttribute("aria-expanded", "false");
    input?.removeAttribute("aria-activedescendant");
    input?.removeAttribute("aria-busy");
  }

  function setUsernameSuggestionIndex(index){
    const suggestions = hubState.usernameSuggestions;
    if(!suggestions.length){
      hubState.usernameSuggestionIndex = -1;
      return;
    }
    const next = (index + suggestions.length) % suggestions.length;
    hubState.usernameSuggestionIndex = next;
    const input = $("chatUsername");
    document.querySelectorAll("#chatUsernameSuggestions [role='option']").forEach((option, optionIndex) => {
      const selected = optionIndex === next;
      option.setAttribute("aria-selected", selected ? "true" : "false");
      if(selected) input?.setAttribute("aria-activedescendant", option.id);
    });
  }

  function renderUsernameSuggestions(results, {showEmpty=false}={}){
    const list = $("chatUsernameSuggestions");
    const input = $("chatUsername");
    if(!list || !input) return;
    list.replaceChildren();
    hubState.usernameSuggestions = Array.isArray(results) ? results : [];
    hubState.usernameSuggestionIndex = -1;
    if(!hubState.usernameSuggestions.length){
      if(!showEmpty){
        clearUsernameSuggestions();
        return;
      }
      list.append(node("p", "hub-username-suggestion-empty", t("messageSearchEmpty")));
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      return;
    }
    hubState.usernameSuggestions.forEach((schoolmate, index) => {
      const option = node("button", "hub-username-suggestion");
      option.type = "button";
      option.id = `chatUsernameSuggestion-${index}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      const avatar = createAvatar(
        schoolmate.display_name || schoolmate.username,
        schoolmate.avatar_path,
        schoolmate.avatar_revision
      );
      const copy = node("span", "hub-username-suggestion-copy");
      copy.append(node("b", "", `@${schoolmate.username}`));
      if(schoolmate.display_name){
        copy.append(node("small", "", schoolmate.display_name));
      }
      option.append(avatar, copy);
      option.addEventListener("pointerdown", event => event.preventDefault());
      option.addEventListener("click", () => {
        void startConversationWithSchoolmate(schoolmate);
      });
      list.append(option);
    });
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  async function searchUsernameSuggestions(query, request){
    if(!authClient || !currentUser || !messageAvailabilityEnabled()) return;
    const context = requestContext();
    hubState.usernameSearchLoading = true;
    $("chatUsername")?.setAttribute("aria-busy", "true");
    let response;
    try {
      response = await hubRpc("search_messageable_schoolmates", {
        p_query:query,
        p_limit:8
      });
    } catch(error){
      response = {error};
    }
    if(
      !contextIsCurrent(context)
      || request !== hubState.usernameSearchRequest
    ) return;
    hubState.usernameSearchLoading = false;
    $("chatUsername")?.removeAttribute("aria-busy");
    if(response.error){
      clearUsernameSuggestions();
      setStatus("chatStatus", featureError(response.error), "error");
      return;
    }
    renderUsernameSuggestions(
      (Array.isArray(response.data) ? response.data : [])
        .filter(schoolmate => (
          schoolmate?.username
          && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(schoolmate.user_id || ""))
        )),
      {showEmpty:true}
    );
  }

  function queueUsernameSearch(){
    if(hubState.usernameSearchTimer){
      window.clearTimeout(hubState.usernameSearchTimer);
    }
    const request = ++hubState.usernameSearchRequest;
    hubState.usernameSearchTimer = 0;
    const query = normalizedMessageUsername($("chatUsername")?.value);
    if(!/^[A-Za-z0-9_]{2,24}$/.test(query)){
      clearUsernameSuggestions();
      return;
    }
    if(!messageAvailabilityEnabled()){
      clearUsernameSuggestions();
      setStatus("chatStatus", t("messageAvailabilityRequired"), "error");
      return;
    }
    hubState.usernameSearchTimer = window.setTimeout(() => {
      hubState.usernameSearchTimer = 0;
      void searchUsernameSuggestions(query, request);
    }, 240);
  }

  function removeMessageExampleClose(){
    $("messageExampleClose")?.remove();
  }

  function messageExampleSeed(){
    if(hubState.messageDemoMessages.length) return;
    hubState.messageDemoMessages = [
      {mine:false, bodyKey:"messageExampleOne", time:"10:18"},
      {mine:true, bodyKey:"messageExampleTwo", time:"10:21"},
      {mine:false, bodyKey:"messageExampleThree", time:"10:24"}
    ];
  }

  function renderMessageExample(){
    hubState.messageDemoMode = true;
    hubState.messageDemoDismissed = false;
    messageExampleSeed();
    document.querySelectorAll("#conversationList .hub-message-demo-launcher").forEach(button => button.classList.add("active"));
    $("chatHeading").textContent = t("messageExampleName");
    $("chatSubheading").textContent = communitySeedText({
      en:"Finance · Year 3",
      "zh-CN":"金融学 · 三年级",
      "zh-HK":"金融 · 三年級"
    });
    const list = $("chatMessages");
    list.replaceChildren();
    hubState.messageDemoMessages.forEach(message => {
      const bubble = node("div", `hub-message${message.mine ? " mine" : ""}`, message.bodyKey ? t(message.bodyKey) : message.body);
      bubble.append(node("time", "", message.time));
      list.append(bubble);
    });
    $("chatMessageInput").placeholder = t("writePrivateMessage");
    $("chatMessageInput").disabled = false;
    $("sendChatMessage").textContent = t("send");
    $("sendChatMessage").disabled = false;
    $("reportConversation").disabled = true;
    $("blockConversationUser").disabled = true;
    let close = $("messageExampleClose");
    if(!close){
      close = node("button", "btn-ghost", communitySeedText({en:"Close chat", "zh-CN":"关闭对话", "zh-HK":"關閉對話"}));
      close.type = "button";
      close.id = "messageExampleClose";
      close.onclick = () => {
        hubState.messageDemoMode = false;
        hubState.messageDemoDismissed = true;
        clearActiveConversation();
        renderConversations([]);
      };
      $("refreshMessages").before(close);
    } else close.textContent = communitySeedText({en:"Close chat", "zh-CN":"关闭对话", "zh-HK":"關閉對話"});
    requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }

  function appendMessageExampleLauncher(list){
    const launcher = node("button", `hub-conversation-button hub-message-demo-launcher${hubState.messageDemoMode ? " active" : ""}`);
    launcher.type = "button";
    const mark = createAvatar("Alex Wong", null, 0, "hub-message-demo-avatar");
    const photo = node("img", "hub-message-demo-photo");
    photo.src = "concourse-campus-community.jpg";
    photo.alt = "";
    photo.loading = "eager";
    photo.decoding = "async";
    mark.append(photo);
    const copy = node("div");
    copy.append(node("b", "", t("messageExampleName")), node("span", "", t("messageExampleOne")));
    launcher.append(mark, copy);
    launcher.onclick = renderMessageExample;
    list.append(launcher);
  }

  function updateConversationRow(button, conversation){
    const name = conversation.other_display_name || conversation.other_username;
    const avatarSignature = [
      name || "",
      conversation.other_avatar_path || "",
      Number(conversation.other_avatar_revision || 0)
    ].join("::");
    button._conversation = conversation;
    button.classList.toggle("active", conversation.conversation_id === hubState.activeConversationId);
    button.setAttribute(
      "aria-label",
      `${identityLabel(conversation.other_display_name, conversation.other_username)}: ${conversation.last_message || t("messagesEmpty")}`
    );
    if(button.dataset.avatarSignature !== avatarSignature){
      const nextAvatar = createAvatar(
        name,
        conversation.other_avatar_path,
        conversation.other_avatar_revision
      );
      button.querySelector(".hub-avatar")?.replaceWith(nextAvatar);
      button.dataset.avatarSignature = avatarSignature;
    }
    const copy = button.querySelector("[data-conversation-copy]");
    if(copy){
      copy.replaceChildren(node("b", "", identityLabel(conversation.other_display_name, conversation.other_username)));
      const contextLabel = conversationContextLabel(conversation);
      if(contextLabel) copy.append(node("small", "hub-conversation-context", contextLabel));
      copy.append(node("span", "", conversation.last_message || t("messagesEmpty")));
    }
    return button;
  }

  function createConversationRow(conversation){
    const button = node("button", "hub-conversation-button");
    button.type = "button";
    button.dataset.conversationId = conversation.conversation_id;
    const avatar = createAvatar(
      conversation.other_display_name || conversation.other_username,
      conversation.other_avatar_path,
      conversation.other_avatar_revision
    );
    button.dataset.avatarSignature = [
      conversation.other_display_name || conversation.other_username || "",
      conversation.other_avatar_path || "",
      Number(conversation.other_avatar_revision || 0)
    ].join("::");
    const copy = node("div");
    copy.dataset.conversationCopy = "true";
    button.append(avatar, copy);
    button.onclick = () => {
      if(button._conversation) void openConversation(button._conversation);
    };
    return updateConversationRow(button, conversation);
  }

  function renderConversations(conversations){
    const list = $("conversationList");
    if(!conversations.length){
      list.replaceChildren();
      appendMessageExampleLauncher(list);
      if(!hubState.messageDemoDismissed) renderMessageExample();
      renderConversationPreview();
      return;
    }
    if(!hubState.messageDemoMode) removeMessageExampleClose();
    const existing = new Map(
      [...list.querySelectorAll("[data-conversation-id]")]
        .map(button => [button.dataset.conversationId, button])
    );
    const fragment = document.createDocumentFragment();
    conversations.forEach(conversation => {
      const button = existing.get(conversation.conversation_id) || createConversationRow(conversation);
      fragment.append(updateConversationRow(button, conversation));
    });
    list.replaceChildren(fragment);
    renderConversationPreview();
  }

  const CONVERSATION_RENDER_FIELDS = Object.freeze([
    "conversation_id",
    "other_user_id",
    "other_username",
    "other_display_name",
    "other_avatar_path",
    "other_avatar_revision",
    "last_message",
    "last_message_at",
    "conversation_context",
    "marketplace_listing_id",
    "marketplace_listing_title",
    "other_school_name",
    "can_send"
  ]);

  function conversationRenderSignature(conversations=[]){
    return JSON.stringify(
      conversations.map(conversation => CONVERSATION_RENDER_FIELDS.map(field => conversation?.[field] ?? null))
    );
  }

  function renderConversationPreview(){
    const preview = $("communityConversationPreview");
    if(!preview) return;
    preview.replaceChildren();
    const conversations = hubState.conversations.slice(0, 3);
    if(!conversations.length){
      preview.append(node("p", "hub-conversation-preview-empty", t("noRecentMessages")));
      return;
    }
    conversations.forEach(conversation => {
      const button = node("button", "hub-conversation-preview-button");
      button.type = "button";
      const avatar = createAvatar(conversation.other_display_name || conversation.other_username, conversation.other_avatar_path, conversation.other_avatar_revision, "hub-avatar-small");
      const copy = node("span");
      copy.append(node("b", "", identityLabel(conversation.other_display_name, conversation.other_username)));
      const contextLabel = conversationContextLabel(conversation);
      if(contextLabel) copy.append(node("small", "hub-conversation-context", contextLabel));
      copy.append(node("small", "", conversation.last_message || t("messagesEmpty")));
      button.append(avatar, copy, node("i", "", "→"));
      button.onclick = async () => {
        const context = requestContext();
        const conversationId = conversation.conversation_id;
        await switchView("messages");
        if(!contextIsCurrent(context)) return;
        const current = hubState.conversations.find(item => item.conversation_id === conversationId);
        if(!current) return;
        await openConversation(current);
      };
      preview.append(button);
    });
  }

  function clearActiveConversation(message=t("selectConversation")){
    hubState.messageDemoMode = false;
    removeMessageExampleClose();
    hubState.conversationRequest += 1;
    hubState.activeConversationId = null;
    hubState.activeConversationUserId = null;
    hubState.activeConversationName = "";
    hubState.activeConversationUsername = "";
    hubState.activeConversationContext = "";
    hubState.activeConversationCanSend = false;
    hubState.messages = [];
    hubState.messageHasMore = false;
    hubState.messageNextCursor = null;
    hubState.messageLoadingOlder = false;
    hubState.sendingMessage = false;
    $("chatHeading").textContent = message;
    $("chatSubheading").textContent = "";
    $("chatMessages").replaceChildren(node("div", "hub-message-empty", message));
    $("chatMessageInput").placeholder = t("selectConversation");
    $("chatMessageInput").disabled = true;
    $("sendChatMessage").textContent = t("send");
    $("sendChatMessage").disabled = true;
    $("reportConversation").disabled = true;
    $("blockConversationUser").disabled = true;
  }

  async function loadConversations({force=false, suppressStatus=false}={}){
    if(!authClient || !currentUser) return null;
    const context = requestContext();
    const request = ++hubState.conversationListRequest;
    hubState.loadingConversations = true;
    const conversationList = $("conversationList");
    const listHasStableRows = !!conversationList?.querySelector(".hub-conversation-button");
    if(!hubState.conversations.length && !listHasStableRows){
      conversationList.replaceChildren(node("div", "hub-feed-empty", t("messagesLoading")));
    }
    let data = null;
    let error = null;
    try {
      const response = await hubRpc("get_my_conversations");
      data = response.data;
      error = response.error;
    } catch(requestError){
      error = requestError;
    }
    if(!contextIsCurrent(context) || request !== hubState.conversationListRequest) return;
    hubState.loadingConversations = false;
    if(error){
      if(!conversationList?.querySelector(".hub-conversation-button")){
        conversationList.replaceChildren(node("div", "hub-feed-empty", featureError(error)));
      }
      if(!suppressStatus) setStatus("chatStatus", featureError(error), "error");
      return null;
    }
    const nextConversations = Array.isArray(data) ? data : [];
    const conversationListChanged = (
      conversationRenderSignature(hubState.conversations)
      !== conversationRenderSignature(nextConversations)
    );
    hubState.conversations = nextConversations;
    const shouldRenderConversationList = (
      conversationListChanged
      || !conversationList?.querySelector(".hub-conversation-button")
    );
    if(shouldRenderConversationList) renderConversations(hubState.conversations);
    if(hubState.messageDemoMode){
      return hubState.conversations;
    }
    let active = hubState.activeConversationId
      ? hubState.conversations.find(item => item.conversation_id === hubState.activeConversationId)
      : null;
    if(hubState.activeConversationId && !active) clearActiveConversation();
    if(!active && hubState.activeView === "messages") active = hubState.conversations[0] || null;
    if(active){
      const selectionWasAlreadyRendered = hubState.activeConversationId === active.conversation_id;
      await openConversation(active, {skipConversationRender:selectionWasAlreadyRendered, showLoading:!force});
    } else if(hubState.activeView === "messages" && !hubState.conversations.length){
      if(hubState.messageDemoMode) renderMessageExample();
      else {
        clearActiveConversation();
        $("chatMessages").replaceChildren(node("div", "hub-message-empty", t("noConversations")));
      }
    }
    return hubState.conversations;
  }

  function messageSortKey(message){
    return `${message?.created_at || ""}::${message?.message_id || message?.id || ""}`;
  }

  function normalizeMessageRows(rows){
    const unique = new Map();
    (Array.isArray(rows) ? rows : []).forEach(message => {
      const key = message?.message_id || message?.id || messageSortKey(message);
      if(key) unique.set(key, message);
    });
    return [...unique.values()].sort((left, right) => messageSortKey(left).localeCompare(messageSortKey(right)));
  }

  function messageCursorValue(cursor, ...keys){
    for(const key of keys){
      if(cursor?.[key] !== undefined && cursor?.[key] !== null) return cursor[key];
    }
    return null;
  }

  async function requestConversationMessagePage(conversationId, cursor=null){
    const beforeCreatedAt = messageCursorValue(cursor, "before_created_at", "created_at", "next_before_created_at");
    const beforeId = messageCursorValue(cursor, "before_id", "id", "message_id", "next_before_id");
    let response = await hubRpc("get_conversation_messages_page", {
      p_conversation_id:conversationId,
      p_limit:MESSAGE_PAGE_SIZE,
      p_before_created_at:beforeCreatedAt,
      p_before_id:beforeId
    });
    if(!response.error){
      const payload = parseJsonValue(response.data, response.data) || {};
      return {
        items:normalizeMessageRows(payload.items),
        hasMore:payload.has_more === true,
        nextCursor:parseJsonValue(payload.next_cursor, payload.next_cursor) || null,
        legacy:false,
        error:null
      };
    }
    if(!missingRpcError(response.error)) return {items:[], hasMore:false, nextCursor:null, legacy:false, error:response.error};

    // Older installations expose only a limit-based RPC. Increasing the limit
    // still lets a user reach the complete conversation until the cursor
    // migration is deployed.
    const legacyLimit = Math.min(
      500,
      Math.max(MESSAGE_PAGE_SIZE, Number(cursor?.legacy_limit || MESSAGE_PAGE_SIZE))
    );
    response = await hubRpc("get_conversation_messages", {
      p_conversation_id:conversationId,
      p_limit:legacyLimit
    });
    return {
      items:normalizeMessageRows(response.data),
      hasMore:!response.error && Array.isArray(response.data) && response.data.length === legacyLimit && legacyLimit < 500,
      nextCursor:response.error ? null : {legacy_limit:Math.min(500, legacyLimit + MESSAGE_PAGE_SIZE)},
      legacy:true,
      error:response.error || null
    };
  }

  function renderMessages(messages, {preserveScroll=false, preserveTop=false}={}){
    const list = $("chatMessages");
    const previousHeight = list.scrollHeight;
    const previousTop = list.scrollTop;
    list.replaceChildren();
    if(!messages.length){ list.append(node("div", "hub-message-empty", t("messagesEmpty"))); return; }
    if(hubState.messageHasMore){
      const older = node(
        "button",
        "hub-message-load-older",
        hubState.messageLoadingOlder
          ? communitySeedText({en:"Loading Earlier Messages…", "zh-CN":"正在加载更早的消息…", "zh-HK":"正在載入較早嘅訊息…"})
          : communitySeedText({en:"Load Earlier Messages", "zh-CN":"加载更早的消息", "zh-HK":"載入較早嘅訊息"})
      );
      older.type = "button";
      older.disabled = hubState.messageLoadingOlder;
      older.onclick = () => void loadOlderMessages();
      list.append(older);
    }
    messages.forEach(message => {
      const bubble = node("div", `hub-message${message.sender_id === currentUser?.id ? " mine" : ""}`, message.body || "");
      bubble.append(node("time", "", formatCompactDate(message.created_at)));
      list.append(bubble);
    });
    requestAnimationFrame(() => {
      if(preserveTop) list.scrollTop = previousTop;
      else if(preserveScroll) list.scrollTop = Math.max(0, list.scrollHeight - previousHeight + previousTop);
      else list.scrollTop = list.scrollHeight;
    });
  }

  async function loadOlderMessages(){
    if(
      hubState.messageLoadingOlder
      || !hubState.messageHasMore
      || !hubState.activeConversationId
      || !hubState.messageNextCursor
    ) return;
    const context = requestContext();
    const conversationId = hubState.activeConversationId;
    hubState.messageLoadingOlder = true;
    renderMessages(hubState.messages, {preserveScroll:true});
    let page;
    try {
      page = await requestConversationMessagePage(conversationId, hubState.messageNextCursor);
    } catch(error){
      page = {items:[], hasMore:hubState.messageHasMore, nextCursor:hubState.messageNextCursor, legacy:false, error};
    }
    if(!contextIsCurrent(context) || hubState.activeConversationId !== conversationId) return;
    hubState.messageLoadingOlder = false;
    if(page.error){
      setStatus("chatStatus", featureError(page.error), "error");
      renderMessages(hubState.messages, {preserveScroll:true});
      return;
    }
    hubState.messages = page.legacy
      ? page.items
      : normalizeMessageRows([...page.items, ...hubState.messages]);
    hubState.messageHasMore = page.hasMore;
    hubState.messageNextCursor = page.nextCursor;
    setStatus("chatStatus", "");
    renderMessages(hubState.messages, {preserveScroll:true});
  }

  function renderActiveConversationHeader(){
    if(hubState.messageDemoMode) return;
    if(hubState.activeConversationId){
      $("chatHeading").textContent = hubState.activeConversationName;
      $("chatSubheading").textContent = [
        hubState.activeConversationContext,
        hubState.activeConversationCanSend ? "" : t("conversationReadOnly"),
        t("directMessagePrivacy")
      ].filter(Boolean).join(" · ");
      $("chatMessageInput").placeholder = t(hubState.activeConversationCanSend ? "writePrivateMessage" : "conversationReadOnly");
    } else {
      $("chatHeading").textContent = t("selectConversation");
      $("chatSubheading").textContent = "";
      $("chatMessageInput").placeholder = t("selectConversation");
    }
  }

  async function openConversation(conversation, {skipConversationRender=false, showLoading=true}={}){
    hubState.messageDemoMode = false;
    hubState.messageDemoDismissed = false;
    removeMessageExampleClose();
    $("sendChatMessage").textContent = t("send");
    const context = requestContext();
    const request = ++hubState.conversationRequest;
    const sameConversation = hubState.activeConversationId === conversation.conversation_id;
    const messageList = $("chatMessages");
    const preserveReadingPosition = (
      sameConversation
      && messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight > 80
    );
    hubState.activeConversationId = conversation.conversation_id;
    hubState.activeConversationUserId = conversation.other_user_id;
    hubState.activeConversationName = identityLabel(conversation.other_display_name, conversation.other_username);
    hubState.activeConversationUsername = conversation.other_username || "";
    hubState.activeConversationContext = conversationContextLabel(conversation);
    hubState.activeConversationCanSend = conversation.can_send !== false;
    renderActiveConversationHeader();
    $("chatMessageInput").disabled = hubState.sendingMessage || !hubState.activeConversationCanSend;
    $("sendChatMessage").disabled = hubState.sendingMessage || !hubState.activeConversationCanSend;
    $("reportConversation").disabled = false;
    $("blockConversationUser").disabled = !hubState.activeConversationUserId;
    if(!skipConversationRender) renderConversations(hubState.conversations);
    if(showLoading || !hubState.messages.length){
      $("chatMessages").replaceChildren(node("div", "hub-message-empty", t("messagesLoading")));
    }
    if(!sameConversation){
      hubState.messages = [];
      hubState.messageHasMore = false;
      hubState.messageNextCursor = null;
      hubState.messageLoadingOlder = false;
    }
    let page = null;
    try {
      page = await requestConversationMessagePage(conversation.conversation_id);
    } catch(requestError){
      page = {items:[], hasMore:false, nextCursor:null, legacy:false, error:requestError};
    }
    if(!contextIsCurrent(context) || request !== hubState.conversationRequest || hubState.activeConversationId !== conversation.conversation_id) return;
    if(page.error){
      $("chatMessages").replaceChildren(node("div", "hub-message-empty", featureError(page.error)));
      setStatus("chatStatus", featureError(page.error), "error");
      return;
    }
    setStatus("chatStatus", "");
    const retainedHistory = sameConversation && hubState.messages.length > page.items.length;
    hubState.messages = retainedHistory
      ? normalizeMessageRows([...hubState.messages, ...page.items])
      : page.items;
    if(!retainedHistory){
      hubState.messageHasMore = page.hasMore;
      hubState.messageNextCursor = page.nextCursor;
    }
    renderMessages(hubState.messages, {preserveTop:preserveReadingPosition});
  }

  async function openConversationById(conversationId){
    const id = String(conversationId || "");
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return false;
    hubState.activeConversationId = id;
    await switchView("messages");
    let conversation = hubState.conversations.find(item => item.conversation_id === id);
    if(!conversation){
      await loadConversations({force:true, suppressStatus:true});
      conversation = hubState.conversations.find(item => item.conversation_id === id);
    }
    if(!conversation) return false;
    await openConversation(conversation, {skipConversationRender:false, showLoading:true});
    return true;
  }

  async function startConversation(options={}){
    if(options instanceof Event) options = {};
    const username = normalizedMessageUsername(
      options.username || $("chatUsername").value
    );
    const targetUserId = String(options.userId || "");
    const preserveDemo = hubState.messageDemoMode;
    if(!username) return false;
    if(!messageAvailabilityEnabled()){
      setStatus("chatStatus", t("messageAvailabilityRequired"), "error");
      return false;
    }
    if(!/^[A-Za-z0-9_]{3,24}$/.test(username)){
      setStatus("chatStatus", t("chatUsernameInvalid"), "error");
      return false;
    }
    if(username === String(currentUser?.user_metadata?.username || "")){
      setStatus("chatStatus", t("cannotMessageSelf"), "error");
      return false;
    }
    const button = $("startConversation");
    if(button.disabled) return false;
    const context = requestContext();
    button.disabled = true;
    clearUsernameSuggestions({cancel:true});
    setStatus("chatStatus", t("startingConversation"));
    try {
      let response = targetUserId
        ? await hubRpc(
          "start_direct_conversation_by_user",
          {p_user_id:targetUserId}
        )
        : await hubRpc(
          "start_direct_conversation",
          {p_username:username}
        );
      if(targetUserId && response.error && missingRpcError(response.error)){
        response = await hubRpc(
          "start_direct_conversation",
          {p_username:username}
        );
      }
      if(!contextIsCurrent(context)) return false;
      if(response.error){
        setStatus("chatStatus", conversationStartError(response.error), "error");
        if(preserveDemo) renderMessageExample();
        return false;
      }
      const firstResult = Array.isArray(response.data)
        ? response.data[0]
        : response.data;
      const conversationId = typeof firstResult === "object"
        ? firstResult?.conversation_id || firstResult?.id
        : firstResult;
      if(!conversationId){
        setStatus("chatStatus", t("conversationStartFailed"), "error");
        if(preserveDemo) renderMessageExample();
        return false;
      }
      hubState.messageDemoMode = false;
      hubState.messageDemoDismissed = false;
      removeMessageExampleClose();
      $("sendChatMessage").textContent = t("send");
      $("chatUsername").value = "";
      setStatus("chatStatus", t("conversationStarted"), "success");
      await loadConversations({force:true, suppressStatus:true});
      if(!contextIsCurrent(context)) return false;
      let conversation = hubState.conversations.find(item => item.conversation_id === conversationId);
      if(!conversation){
        conversation = {
          conversation_id: conversationId,
          other_user_id: targetUserId || null,
          other_username: username,
          other_display_name: null,
          other_avatar_path: null,
          other_avatar_revision: 0,
          last_message: null,
          last_message_at: null,
          conversation_context: "campus",
          marketplace_listing_id: null,
          marketplace_listing_title: null,
          other_school_name: null,
          can_send: true
        };
        hubState.conversations = [conversation, ...hubState.conversations];
        renderConversations(hubState.conversations);
      }
      await openConversation(conversation);
      return true;
    } catch(requestError){
      if(contextIsCurrent(context)){
        setStatus("chatStatus", conversationStartError(requestError), "error");
        if(preserveDemo) renderMessageExample();
      }
      return false;
    } finally {
      if(contextIsCurrent(context)) button.disabled = false;
    }
  }

  async function startConversationWithSchoolmate(schoolmate){
    const username = normalizedMessageUsername(schoolmate?.username);
    const userId = String(schoolmate?.user_id || "");
    if(
      !/^[A-Za-z0-9_]{3,24}$/.test(username)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    ) return false;
    $("chatUsername").value = username;
    return startConversation({username, userId});
  }

  async function startConversationWithUsername(username){
    const exactUsername = normalizedMessageUsername(username);
    if(!/^[A-Za-z0-9_]{3,24}$/.test(exactUsername) || !currentUser){
      return false;
    }
    const context = requestContext();
    await switchView("messages");
    if(!contextIsCurrent(context)) return false;
    $("chatUsername").value = exactUsername;
    return startConversation({username:exactUsername});
  }

  async function sendMessage(){
    const button = $("sendChatMessage");
    if(hubState.messageDemoMode){
      const body = $("chatMessageInput").value.trim();
      if(!body){ setStatus("chatStatus", t("messageRequired"), "error"); return; }
      hubState.messageDemoMessages.push({mine:true, body, time:new Date().toLocaleTimeString(locale(), {hour:"2-digit", minute:"2-digit"})});
      $("chatMessageInput").value = "";
      setStatus("chatStatus", communitySeedText({en:"Message added.", "zh-CN":"消息已添加。", "zh-HK":"訊息已加入。"}), "success");
      renderMessageExample();
      $("chatMessageInput").focus();
      return;
    }
    if(button.disabled || !hubState.activeConversationCanSend || hubState.sendingMessage) return;
    const body = $("chatMessageInput").value.trim();
    if(!body){ setStatus("chatStatus", t("messageRequired"), "error"); return; }
    if(!hubState.activeConversationId) return;
    const context = requestContext();
    const conversationId = hubState.activeConversationId;
    hubState.sendingMessage = true;
    button.disabled = true;
    $("chatMessageInput").disabled = true;
    setStatus("chatStatus", t("sendingMessage"));
    try {
      const { error } = await hubRpc("send_direct_message", {
        p_conversation_id:conversationId,
        p_body:body,
        p_client_nonce:crypto.randomUUID()
      });
      if(!contextIsCurrent(context)) return;
      if(error){
        setStatus("chatStatus", featureError(error) || t("messageSendFailed"), "error");
        return;
      }
      const conversationStillActive = hubState.activeConversationId === conversationId;
      if(conversationStillActive) $("chatMessageInput").value = "";
      setStatus("chatStatus", "");
      const active = hubState.conversations.find(item => item.conversation_id === conversationId);
      if(active && conversationStillActive) await openConversation(active);
      await loadConversations({force:true});
    } catch(requestError){
      if(contextIsCurrent(context)) setStatus("chatStatus", featureError(requestError) || t("messageSendFailed"), "error");
    } finally {
      if(contextIsCurrent(context)){
        hubState.sendingMessage = false;
        const canSend = !!hubState.activeConversationId && hubState.activeConversationCanSend;
        $("chatMessageInput").disabled = !canSend;
        button.disabled = !canSend;
      }
    }
  }

  async function reportConversation(){
    if(!hubState.activeConversationId) return;
    const context = requestContext();
    const conversationId = hubState.activeConversationId;
    const reason = await requestHubAction({title:t("report"), message:t("reportReasonPrompt"), input:true, confirmLabel:t("report"), danger:true});
    if(!reason) return;
    const { error } = await authClient.rpc("report_conversation_user", {
      p_conversation_id:conversationId,
      p_reason:reason.trim()
    });
    if(!contextIsCurrent(context)) return;
    setStatus("chatStatus", error ? featureError(error) : t("reported"), error ? "error" : "success");
  }

  async function blockConversationUser(){
    if(!hubState.activeConversationUserId) return;
    const context = requestContext();
    const userId = hubState.activeConversationUserId;
    const username = hubState.activeConversationUsername || hubState.activeConversationName;
    const confirmed = await requestHubAction({title:t("block"), message:t("confirmBlock", {username}), confirmLabel:t("block"), danger:true});
    if(!confirmed) return;
    if(!contextIsCurrent(context)) return;
    const { error } = await authClient.rpc("block_community_user", {p_user_id:userId});
    if(!contextIsCurrent(context)) return;
    if(error){ setStatus("chatStatus", featureError(error), "error"); return; }
    setStatus("chatStatus", t("blocked"), "success");
    clearActiveConversation();
    await loadConversations({force:true});
  }

  function syncAccess(){
    const nextUserId = currentUser?.id || null;
    if(hubState.sessionUserId !== nextUserId) resetSensitiveState(nextUserId);
    const allowed = hubAccessAllowed();
    const fullHubAvailable = allowed && !!finalTimetable?.savedAt;
    if($("enterMemberHub")) $("enterMemberHub").hidden = !fullHubAvailable;
    if(!allowed && !$("memberHub").hidden) hideHub();
    if(currentUser && hubState.adminContextUserId !== currentUser.id && !hubState.adminContextLoading){
      void loadAdminContext().catch(error => console.warn("ConCourse administrator context could not be loaded.", error));
    }
    renderAdminAccess();
    if(allowed){
      renderOverview();
      if(!hubState.profileUserId) loadMemberProfile().catch(console.warn);
      if(!hubState.socialConnectionUserId && !hubState.socialConnectionLoading) loadSocialConnections().catch(console.warn);
      const postHash = String(window.location.hash || "").match(/^#(cross-)?post-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      if(postHash && $("memberHub").hidden){
        hubState.feedScope = postHash[1] ? "cross" : "school";
        hubState.feedTopic = "all";
        showHub("community");
        return;
      }
    }
    window.ConCourseMarketplace?.syncAccess();
    window.syncPrimaryNavigation?.();
    renderSocialConnections();
    if(!$("memberHub").hidden){
      if(hubState.activeView === "overview" && hubState.insightsLoaded){
        if(hubState.insightDemoMode) renderInsightExample(hubState.insightDemoMode);
        else renderInsights(hubState.insightRows, {dimensions:hubState.insightDimensions});
      }
      if(hubState.activeView === "community") renderCommunityFeed(hubState.feed);
      if(hubState.activeView === "community") renderConversationPreview();
      if(hubState.activeView === "messages"){
        renderMessageAvailability();
        renderConversations(hubState.conversations);
        if(hubState.messageDemoMode) renderMessageExample();
        else {
          renderActiveConversationHeader();
          if(hubState.activeConversationId) renderMessages(hubState.messages);
          else $("chatMessages").replaceChildren(node("div", "hub-message-empty", t("selectConversation")));
        }
      }
      if(!$('schoolmateProfileModal').hidden) renderSchoolmateProfile();
    }
  }

  $("hubOpenBtn")?.addEventListener("click", () => showHub("community"));
  $("enterMemberHub")?.addEventListener("click", () => showHub("community"));
  $("overviewOpenTimetable")?.addEventListener("click", showTimetable);
  document.querySelectorAll("[data-hub-target]").forEach(button => button.addEventListener("click", async () => {
    await switchView(button.dataset.hubTarget);
    const hub = $("memberHub");
    if(!hub || hub.hidden) return;
    if(button.hasAttribute("data-profile-entry")){
      $("hubProfileHeading")?.focus({preventScroll:true});
    }
    const offset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-bar-offset")) || 76;
    const top = Math.max(0, hub.getBoundingClientRect().top + window.scrollY - offset);
    window.scrollTo({
      top,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  }));
  $("loadCourseInsights")?.addEventListener("click", loadCourseInsights);
  $("ownerVerificationStatusFilter")?.addEventListener("change", event => {
    hubState.adminQueueStatus = event.target.value;
    void loadVerificationCenterQueue({force:true});
  });
  $("refreshOwnerVerificationQueue")?.addEventListener("click", () => {
    void Promise.all([
      loadVerificationCenterQueue({force:true}),
      loadVerificationCenterCounts({force:true})
    ]);
  });
  $("verificationCenterTabs")?.addEventListener("click", event => {
    const tab = event.target.closest?.("[data-verification-workflow]");
    if(!tab || tab.hidden) return;
    void switchVerificationWorkflow(tab.dataset.verificationWorkflow, {focus:true});
  });
  $("verificationCenterTabs")?.addEventListener("keydown", event => {
    if(!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...$("verificationCenterTabs").querySelectorAll("[data-verification-workflow]:not([hidden])")];
    if(!tabs.length) return;
    const current = Math.max(0, tabs.indexOf(document.activeElement));
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    void switchVerificationWorkflow(tabs[next].dataset.verificationWorkflow, {focus:true});
  });
  $("verificationTeamAppointmentForm")?.addEventListener("submit", event => {
    event.preventDefault();
    void appointVerificationAdmin();
  });
  $("refreshOwnerOperationalSummary")?.addEventListener("click", () => void loadOwnerOperationalSummary({force:true}));
  $("previewCourseInsights")?.addEventListener("click", () => renderInsightExample("major"));
  $("courseInsightScope")?.addEventListener("change", syncInsightYearControl);
  $("courseInsightChart")?.addEventListener("click", event => {
    const button = event.target.closest?.("[data-insight-example-action]");
    if(!button) return;
    const action = button.dataset.insightExampleAction;
    if(action === "preview") renderInsightExample("major");
    else if(action === "major" || action === "university") renderInsightExample(action);
    else if(action === "close"){
      hubState.insightDemoMode = "";
      renderInsights(hubState.insightRows);
    }
  });
  $("saveMemberProfile")?.addEventListener("click", saveMemberProfile);
  $("chooseProfileAvatar")?.addEventListener("click", () => $("profileAvatarInput").click());
  $("profileAvatarInput")?.addEventListener("change", event => void prepareProfileAvatar(event.target.files?.[0]));
  $("removeProfileAvatar")?.addEventListener("click", markAvatarForRemoval);
  document.querySelectorAll("[data-connection-tab]").forEach(button => {
    button.addEventListener("click", () => switchConnectionTab(button.dataset.connectionTab));
    button.addEventListener("keydown", handleConnectionTabKeydown);
  });
  $("providerConnections")?.addEventListener("click", event => {
    const button = event.target.closest("[data-social-action][data-provider]");
    if(!button || !$("providerConnections").contains(button)) return;
    const provider = button.dataset.provider;
    if(!SOCIAL_PROVIDERS[provider]) return;
    if(button.dataset.socialAction === "connect"){
      void connectSocialProvider(provider).catch(error => handleUnexpectedSocialActionError(provider, "connect", error));
    } else if(button.dataset.socialAction === "disconnect"){
      void disconnectSocialProvider(provider).catch(error => handleUnexpectedSocialActionError(provider, "disconnect", error));
    }
  });
  $("publishCommunityPost")?.addEventListener("click", publishCommunityPost);
  $("communityPostBody")?.addEventListener("input", updateCommunityPostCounter);
  $("addCommunityMedia")?.addEventListener("click", () => $("communityMediaInput").click());
  $("communityMediaInput")?.addEventListener("change", event => void prepareCommunityMedia(event.target.files));
  $("communityPostBody")?.addEventListener("paste", event => {
    const files = [...(event.clipboardData?.files || [])].filter(file => (
      String(file.type || "").startsWith("image/") ||
      String(file.type || "").startsWith("video/")
    ));
    if(!files.length) return;
    event.preventDefault();
    void prepareCommunityMedia(files);
  });
  $("addCommunityPoll")?.addEventListener("click", event => {
    const builder = $("communityPollBuilder");
    if(!builder) return;
    builder.hidden = false;
    event.currentTarget.setAttribute("aria-expanded", "true");
    event.currentTarget.classList.add("is-active");
    $("communityPollQuestion")?.focus();
  });
  $("removeCommunityPoll")?.addEventListener("click", () => resetCommunityPoll({restoreFocus:true}));
  $("addCommunityPollOption")?.addEventListener("click", addCommunityPollOption);
  {
    const composer = $("communityComposer");
    let dragDepth = 0;
    const hasFiles = event => [...(event.dataTransfer?.types || [])].includes("Files");
    const clearDragState = () => {
      dragDepth = 0;
      composer?.classList.remove("is-media-dragging");
    };
    composer?.addEventListener("dragenter", event => {
      if(!hasFiles(event)) return;
      event.preventDefault();
      dragDepth += 1;
      composer.classList.add("is-media-dragging");
    });
    composer?.addEventListener("dragover", event => {
      if(!hasFiles(event)) return;
      event.preventDefault();
      if(event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });
    composer?.addEventListener("dragleave", event => {
      if(!hasFiles(event)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if(!dragDepth) composer.classList.remove("is-media-dragging");
    });
    composer?.addEventListener("drop", event => {
      if(!hasFiles(event)) return;
      event.preventDefault();
      const files = event.dataTransfer?.files;
      clearDragState();
      void prepareCommunityMedia(files);
    });
    window.addEventListener("dragend", clearDragState);
    window.addEventListener("drop", clearDragState);
  }
  $("refreshCommunityFeed")?.addEventListener("click", () => loadCommunityFeed({force:true}));
  $("communityLoadMore")?.addEventListener("click", () => loadCommunityFeed({append:true}));
  $("communitySearch")?.addEventListener("input", event => {
    hubState.feedQuery = event.target.value;
    renderCommunityFeed(hubState.feed);
  });
  document.querySelectorAll("[data-community-topic]").forEach(button => button.addEventListener("click", () => selectCommunityTopic(button.dataset.communityTopic || "all")));
  document.querySelectorAll("[data-community-scope]").forEach(button => button.addEventListener("click", () => selectCommunityScope(button.dataset.communityScope || "school")));
  $("communityShowSaved")?.addEventListener("click", () => selectCommunityTopic("saved"));
  $("communityOpenMessages")?.addEventListener("click", () => switchView("messages"));
  $("communityStartMessage")?.addEventListener("click", async () => {
    await switchView("messages");
    $("chatUsername").focus();
  });
  $("startConversation")?.addEventListener("click", startConversation);
  $("chatUsername")?.addEventListener("keydown", event => {
    if(event.key === "ArrowDown" && hubState.usernameSuggestions.length){
      event.preventDefault();
      setUsernameSuggestionIndex(hubState.usernameSuggestionIndex + 1);
      return;
    }
    if(event.key === "ArrowUp" && hubState.usernameSuggestions.length){
      event.preventDefault();
      setUsernameSuggestionIndex(
        hubState.usernameSuggestionIndex < 0
          ? hubState.usernameSuggestions.length - 1
          : hubState.usernameSuggestionIndex - 1
      );
      return;
    }
    if(event.key === "Escape"){
      clearUsernameSuggestions({cancel:true});
      return;
    }
    if(event.key === "Enter" && !event.isComposing && event.keyCode !== 229){
      event.preventDefault();
      const selected = hubState.usernameSuggestions[hubState.usernameSuggestionIndex];
      if(selected) void startConversationWithSchoolmate(selected);
      else void startConversation();
    }
  });
  $("chatUsername")?.addEventListener("input", () => {
    setStatus("chatStatus", "");
    queueUsernameSearch();
  });
  $("messageAvailability")?.addEventListener("change", event => {
    void setMessageAvailability(event.target.checked);
  });
  document.addEventListener("pointerdown", event => {
    if(!event.target.closest?.(".hub-username-search")){
      clearUsernameSuggestions();
    }
  });
  $("refreshMessages")?.addEventListener("click", () => loadConversations({force:true}));
  $("reportConversation")?.addEventListener("click", reportConversation);
  $("blockConversationUser")?.addEventListener("click", blockConversationUser);
  $("closeSchoolmateProfile")?.addEventListener("click", closeSchoolmateProfile);
  $("schoolmateProfileMessage")?.addEventListener("click", messageProfileStudent);
  $("schoolmateProfileModal")?.addEventListener("click", event => { if(event.target === $("schoolmateProfileModal")) closeSchoolmateProfile(); });
  $("hubActionCancel")?.addEventListener("click", () => closeHubAction());
  $("hubActionConfirm")?.addEventListener("click", () => {
    const input = $("hubActionInput");
    if(hubState.actionHasInput){
      const value = input.value.trim();
      if(hubState.actionInputRequired && !value){ input.setCustomValidity(hubState.actionRequiredMessage || t("reasonRequired")); input.reportValidity(); input.setCustomValidity(""); return; }
      closeHubAction(value);
    } else closeHubAction(true);
  });
  $("hubActionModal")?.addEventListener("click", event => { if(event.target === $("hubActionModal")) closeHubAction(); });
  document.addEventListener("keydown", event => {
    const actionModal = $("hubActionModal");
    const profileModal = $("schoolmateProfileModal");
    const modal = !actionModal.hidden ? actionModal : (!profileModal.hidden ? profileModal : null);
    if(!modal) return;
    if(event.key === "Escape"){
      event.preventDefault();
      if(modal === actionModal) closeHubAction();
      else closeSchoolmateProfile();
      return;
    }
    if(event.key === "Tab"){
      const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]):not([hidden]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if(!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
      else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
    }
  });
  document.querySelector('[data-hub-view="profile"]')?.addEventListener("input", () => {
    if(hubState.profileHydrated && !hubState.profileLoading) hubState.profileDirty = true;
  });
  $("sendChatMessage")?.addEventListener("click", sendMessage);
  $("chatMessageInput")?.addEventListener("keydown", event => {
    if(event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229){ event.preventDefault(); sendMessage(); }
  });
  window.addEventListener("hashchange", () => {
    hubState.highlightedPostId = "";
    const listingMatch = String(window.location.hash || "").match(/^#listing-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
    if(listingMatch){
      return;
    } else if(/^#(?:cross-)?post-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(window.location.hash)){
      hubState.feedScope = /^#cross-post-/i.test(window.location.hash) ? "cross" : "school";
      hubState.feedTopic = "all";
      syncCommunityScopeControls();
      syncCommunityTopicControls();
      if($("memberHub").hidden) showHub("community");
      else void switchView("community");
    } else renderCommunityFeed(hubState.feed);
  });
  window.addEventListener("beforeunload", () => {
    configureMessagePolling(false);
    revokeAvatarUrls();
    revokeCommunityMediaUrls();
  }, {once:true});

  window.ConCourseHub = {
    show: showHub,
    hide: hideHub,
    switchView,
    startConversationWithUsername,
    openConversationById,
    refreshHeader: renderHubHeader,
    syncAccess,
    syncFinalSchedule,
    getInstitutionContext,
    requestAction: requestHubAction,
    openProfile: openSchoolmateProfile,
    mediaTools: Object.freeze({normalizeRasterUpload, normalizeRasterToWebP, videoUploadType, validateVideoSignature, wrapMediaUploadError, mediaUploadError}),
    reloadMembership: () => loadMembership(),
    reloadAdminContext: () => loadAdminContext({force:true}),
    refreshSocialConnections: () => loadSocialConnections({force:true}),
    refreshLanguage: () => {
      document.querySelectorAll("#communityPollOptions [data-poll-option]").forEach((input, index) => {
        input.dataset.pollNumber = String(index + 1);
        input.placeholder = t("pollOptionPlaceholder");
        input.setAttribute("aria-label", t("pollOptionNumber", {number:index + 1}));
      });
      renderComposerMedia();
      updateCommunityPostCounter();
      syncCommunityScopeControls();
      syncAccess();
      renderMessageAvailability();
      if(hubState.usernameSuggestions.length){
        renderUsernameSuggestions(hubState.usernameSuggestions);
      }
      renderAdminAccess();
      renderOwnerConsole();
      if($("hubAccountTrustControls")) renderAccountTrustControls();
      window.ConCourseMarketplace?.refreshLanguage();
      window.ConCourseAcademicTools?.refreshLanguage?.();
    }
  };

  syncInsightYearControl();
  switchConnectionTab("verified");
  observeHubStickyGeometry();
  syncAccess();
})();
