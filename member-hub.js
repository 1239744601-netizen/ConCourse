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
    insightsLoaded: false,
    insightDemoMode: "",
    communitySeedState: new Map(),
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
    sendingMessage: false,
    messagePoll: null,
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
  const HUB_RPC_TIMEOUT_MS = 15000;
  const COMMUNITY_SEED_POSTS = Object.freeze([
    Object.freeze({
      key:"finance-revision",
      initials:"MC",
      author:"Maya Chen",
      avatar:Object.freeze({src:"concourse-community-library.jpg", position:"53% 30%"}),
      meta:Object.freeze({
        en:"Hong Kong Baptist University · Finance · 24 min",
        "zh-CN":"香港浸会大学 · 金融学 · 24 分钟前",
        "zh-HK":"香港浸會大學 · 金融 · 24 分鐘前"
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
        en:"HKBU Sustainability Society · 42 min",
        "zh-CN":"浸大可持续发展学会 · 42 分钟前",
        "zh-HK":"浸大可持續發展學會 · 42 分鐘前"
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
        en:"Hong Kong Baptist University · Computer Science · 1 h",
        "zh-CN":"香港浸会大学 · 计算机科学 · 1 小时前",
        "zh-HK":"香港浸會大學 · 電腦科學 · 1 小時前"
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
    if(/not accepting messages|Messaging is unavailable|blocked the other/i.test(message)) return t("messagingUnavailable");
    if(/No messageable schoolmate/i.test(message)) return t("conversationStartFailed");
    if(/Post is unavailable|Comment is unavailable|Conversation is unavailable|Campus profile is unavailable/i.test(message)) return t("contentUnavailable");
    if(/timed out|timeout|network|failed to fetch|offline|connection/i.test(message)) return t("connectionRetry");
    return t("featureUnavailable");
  };

  const missingRpcError = error => /Could not find the function|schema cache|PGRST202/i.test(errorText(error));

  const conversationStartError = error => {
    const message = errorText(error);
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
      return hubState.membership?.status === "verified" ? t("mediaSetupRequired") : t("schoolVerificationRequired");
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
    hubState.insightsLoaded = false;
    hubState.insightDemoMode = "";
    hubState.communitySeedState = new Map();
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
    hubState.sendingMessage = false;
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
    ["communityFeed", "conversationList", "chatMessages", "courseInsightChart"].forEach(id => $(id)?.replaceChildren());
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
    $("chatHeading").textContent = t("selectConversation");
    $("chatSubheading").textContent = "";
    $("chatMessageInput").disabled = true;
    $("sendChatMessage").disabled = true;
    $("reportConversation").disabled = true;
    $("blockConversationUser").disabled = true;
    ["loadCourseInsights", "publishCommunityPost", "startConversation"].forEach(id => { if($(id)) $(id).disabled = false; });
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
    if(directUrl) setImage(directUrl);
    else void getAvatarUrl(path, revision).then(setImage);
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
    const view = ["community", "marketplace", "messages", "overview", "academic-tools", "profile"].includes(hubState.activeView) ? hubState.activeView : "community";
    const worldwideCommunity = view === "community" && hubState.feedScope === "cross";
    const worldwideMarketplace = view === "marketplace" && $("memberHub")?.dataset.marketplaceScope === "global";
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
    const membershipStatus = ["verified", "rejected", "revoked"].includes(hubState.membership?.status)
      ? hubState.membership.status
      : "pending";
    $("hubMembershipStatus").textContent = t(`membership${membershipStatus[0].toLocaleUpperCase()}${membershipStatus.slice(1)}`);
    $("hubMembershipStatus").className = `hub-membership-status ${membershipStatus}`;
    renderHubHeader();
    $("hubNetworkScope").textContent = getAcademicIdentity().school || "—";
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
    window.syncPrimaryNavigation?.();
    switchView(view);
    window.scrollTo({top:0, behavior:"smooth"});
  }

  async function switchView(view){
    if(!["overview", "community", "marketplace", "messages", "academic-tools", "profile"].includes(view)) view = "community";
    if(view !== "academic-tools") window.ConCourseAcademicTools?.deactivate?.();
    if(view !== "community") closeSchoolmateProfile({restoreFocus:false});
    hubState.activeView = view;
    $("memberHub").dataset.activeView = view;
    renderHubHeader();
    document.querySelectorAll("[data-hub-view]").forEach(element => { element.hidden = element.dataset.hubView !== view; });
    document.querySelectorAll("[data-hub-target]").forEach(button => {
      const active = button.dataset.hubTarget === view;
      button.classList.toggle("active", active);
      if(button.classList.contains("hub-nav-button")){
        if(active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    });
    configureMessagePolling(view === "messages");
    if(view === "overview"){
      renderOverview();
      await loadMembership();
      if(hubState.membership?.status === "verified" && !hubState.insightsLoaded) await loadCourseInsights();
      else if(hubState.membership?.status !== "verified" && !hubState.insightsLoaded){
        insightEmpty(t("courseInsightUnavailable"), hubState.membershipError || t("schoolVerificationRequired"));
      }
    } else if(view === "community"){
      await Promise.all([loadCommunityFeed(), loadConversations()]);
    } else if(view === "marketplace"){
      await window.ConCourseMarketplace?.activate();
    } else if(view === "academic-tools"){
      window.ConCourseAcademicTools?.activate?.();
    } else if(view === "messages"){
      await loadConversations();
    } else if(view === "profile"){
      await Promise.all([loadMemberProfile(), loadSocialConnections({force:true})]);
    }
  }

  function configureMessagePolling(active){
    if(hubState.messagePoll){ clearInterval(hubState.messagePoll); hubState.messagePoll = null; }
    if(!active) return;
    hubState.messagePoll = window.setInterval(() => {
      if(document.visibilityState === "visible" && hubState.activeView === "messages" && !$("memberHub").hidden){
        loadConversations({force:true}).catch(console.warn);
      }
    }, 12000);
  }

  async function loadMembership(){
    if(!authClient || !currentUser) return null;
    const context = requestContext();
    const { data, error } = await authClient
      .from("school_memberships")
      .select("school_name, school_key, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if(!contextIsCurrent(context)) return null;
    if(error){
      hubState.membershipError = featureError(error);
    } else {
      hubState.membershipError = "";
      hubState.membership = data || null;
      if(hubState.membership?.status !== "verified"){
        hubState.insightRows = [];
        hubState.insightsLoaded = false;
      }
    }
    renderIdentity();
    return hubState.membership;
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

  function renderInsights(rows, {exampleMode=""}={}){
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
    const { data, error } = await authClient.rpc("get_course_choice_stats", {
      p_scope: scope,
      p_study_year: ["same_major_year", "university_year"].includes(scope) && yearValue ? Number(yearValue) : null
    });
    if(!contextIsCurrent(context)) return;
    $("loadCourseInsights").disabled = false;
    if(error){
      insightEmpty(t("courseInsightUnavailable"), featureError(error));
      setStatus("courseInsightStatus", featureError(error), "error");
      return;
    }
    setStatus("courseInsightStatus", "");
    hubState.insightRows = data || [];
    hubState.insightsLoaded = true;
    renderInsights(hubState.insightRows);
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
    const username = hubState.profilePreview?.username;
    if(!username || hubState.profilePreview?.user_id === currentUser?.id) return;
    closeSchoolmateProfile({restoreFocus:false});
    await switchView("messages");
    if(!contextIsCurrent(context)) return;
    $("chatUsername").value = username;
    await startConversation();
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

  async function loadPostComments(postId, container){
    const context = requestContext();
    container.replaceChildren(node("div", "hub-comment", t("loading")));
    let data = [];
    let error = null;
    try {
      const response = await hubRpc("get_post_comments", {p_post_id:postId});
      data = response.data || [];
      error = response.error || null;
    } catch(requestError){
      error = requestError;
    }
    if(!contextIsCurrent(context) || !container.isConnected) return;
    container.replaceChildren();
    if(error){
      const loadStatus = node("p", "hub-comment-status error", missingRpcError(error) ? t("memberSetupRequired") : t("commentsUnavailable"));
      loadStatus.setAttribute("role", "status");
      container.append(loadStatus);
    }
    const commentRows = Array.isArray(data) ? data : [];
    if(!error && !commentRows.length){
      container.append(node("p", "hub-comment-status hub-comment-empty", t("commentsEmpty")));
    }
    commentRows.forEach(comment => {
      const item = node("div", "hub-comment");
      const copy = node("div", "hub-comment-copy");
      copy.append(node("b", "", identityLabel(comment.display_name, comment.author_username)));
      if(hubState.feedScope === "cross" && comment.school_name){
        copy.append(node("small", "hub-comment-school", comment.school_name));
      }
      copy.append(node("span", "", comment.body || ""), node("time", "", formatCompactDate(comment.created_at)));
      const actions = node("div", "hub-comment-actions");
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
    const form = node("form", "hub-comment-form");
    form.noValidate = true;
    const input = node("input");
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
        const response = await hubRpc("add_post_comment", {p_post_id:postId, p_body:body});
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
        await loadPostComments(postId, container);
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
    form.append(input, button, submitStatus);
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

  function communitySeedCommentRow(comment, {own=false}={}){
    const author = own
      ? communitySeedText({en:"You", "zh-CN":"你", "zh-HK":"你"})
      : String(comment?.author || t("anonymousStudent"));
    const body = own ? String(comment || "") : communitySeedText(comment?.body || comment);
    const time = own
      ? communitySeedText({en:"now", "zh-CN":"刚刚", "zh-HK":"啱啱"})
      : communitySeedText(comment?.time || "");
    const row = node("article", "hub-community-example-comment");
    const avatar = node("span", "hub-community-example-comment-avatar", initialsFor(author));
    avatar.setAttribute("aria-hidden", "true");
    const copy = node("div");
    const heading = node("p");
    heading.append(node("b", "", author));
    if(time) heading.append(node("time", "", time));
    copy.append(heading, node("span", "", body));
    row.append(avatar, copy);
    return row;
  }

  function renderCommunitySeedPosts(feed){
    const collection = node("section", "hub-community-example hub-community-seed-feed");
    collection.setAttribute("aria-label", t("campusFeed"));

    COMMUNITY_SEED_POSTS.forEach(seed => {
      const state = communitySeedPostState(seed.key);
      const post = node("article", "hub-post-card hub-post-card--media hub-post-card--seed");
      post.dataset.communitySeed = seed.key;

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
      comments.onclick = () => post.querySelector(".hub-community-example-comment-input")?.focus();
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
      seed.comments.forEach(comment => {
        commentList.append(communitySeedCommentRow(comment));
      });
      state.comments.forEach(comment => {
        commentList.append(communitySeedCommentRow(comment, {own:true}));
      });
      commentArea.append(commentList);
      const form = node("div", "hub-community-example-comment-form");
      const input = node("input", "hub-community-example-comment-input");
      input.maxLength = 240;
      input.placeholder = t("writeComment");
      input.setAttribute("aria-label", t("writeComment"));
      const submit = node("button", "", t("postComment"));
      submit.type = "button";
      const addComment = () => {
        const value = input.value.trim();
        if(!value) return;
        state.comments.push(value);
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
    if(!authClient || !currentUser){
      if(!append && communitySeedAvailable()) renderCommunityFeed([]);
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
      if(communitySeedAvailable()) renderCommunityFeed([]);
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
      const canShowSeedPosts = !append && communitySeedAvailable();
      if(canShowSeedPosts){
        hubState.feed = [];
        hubState.feedMode = mode;
        hubState.feedOffset = 0;
        hubState.feedHasMore = false;
        renderCommunityFeed([]);
        setStatus("communityFeedStatus", message, "error");
      } else if(!append) replaceCommunityFeed(node("div", "hub-feed-empty", message));
      else setStatus("communityComposerStatus", featureError(error), "error");
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

  function renderConversations(conversations){
    const list = $("conversationList");
    list.replaceChildren();
    if(!conversations.length){
      appendMessageExampleLauncher(list);
      if(!hubState.messageDemoDismissed) renderMessageExample();
      renderConversationPreview();
      return;
    }
    if(!hubState.messageDemoMode) removeMessageExampleClose();
    conversations.forEach(conversation => {
      const button = node("button", "hub-conversation-button");
      button.type = "button";
      button.classList.toggle("active", conversation.conversation_id === hubState.activeConversationId);
      const avatar = createAvatar(conversation.other_display_name || conversation.other_username, conversation.other_avatar_path, conversation.other_avatar_revision);
      const copy = node("div");
      copy.append(node("b", "", identityLabel(conversation.other_display_name, conversation.other_username)));
      const contextLabel = conversationContextLabel(conversation);
      if(contextLabel) copy.append(node("small", "hub-conversation-context", contextLabel));
      copy.append(node("span", "", conversation.last_message || t("messagesEmpty")));
      button.append(avatar, copy);
      button.onclick = () => openConversation(conversation);
      list.append(button);
    });
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

  function renderMessages(messages){
    const list = $("chatMessages");
    list.replaceChildren();
    if(!messages.length){ list.append(node("div", "hub-message-empty", t("messagesEmpty"))); return; }
    messages.forEach(message => {
      const bubble = node("div", `hub-message${message.sender_id === currentUser?.id ? " mine" : ""}`, message.body || "");
      bubble.append(node("time", "", formatCompactDate(message.created_at)));
      list.append(bubble);
    });
    requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
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
    let data = null;
    let error = null;
    try {
      const response = await hubRpc("get_conversation_messages", {p_conversation_id:conversation.conversation_id, p_limit:100});
      data = response.data;
      error = response.error;
    } catch(requestError){
      error = requestError;
    }
    if(!contextIsCurrent(context) || request !== hubState.conversationRequest || hubState.activeConversationId !== conversation.conversation_id) return;
    if(error){
      $("chatMessages").replaceChildren(node("div", "hub-message-empty", featureError(error)));
      setStatus("chatStatus", featureError(error), "error");
      return;
    }
    setStatus("chatStatus", "");
    hubState.messages = Array.isArray(data) ? data : [];
    renderMessages(hubState.messages);
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

  async function startConversation(){
    const username = $("chatUsername").value.trim().replace(/^@/, "");
    if(!username) return;
    hubState.messageDemoMode = false;
    hubState.messageDemoDismissed = false;
    removeMessageExampleClose();
    $("sendChatMessage").textContent = t("send");
    if(!/^[A-Za-z0-9_]{3,24}$/.test(username)){
      setStatus("chatStatus", t("chatUsernameInvalid"), "error");
      return;
    }
    if(username === currentUser?.user_metadata?.username){ setStatus("chatStatus", t("cannotMessageSelf"), "error"); return; }
    const button = $("startConversation");
    if(button.disabled) return;
    const context = requestContext();
    button.disabled = true;
    setStatus("chatStatus", t("startingConversation"));
    try {
      const { data, error } = await hubRpc("start_direct_conversation", {p_username:username});
      if(!contextIsCurrent(context)) return;
      if(error){ setStatus("chatStatus", conversationStartError(error), "error"); return; }
      const conversationId = Array.isArray(data) ? data[0]?.conversation_id : data;
      if(!conversationId){ setStatus("chatStatus", t("conversationStartFailed"), "error"); return; }
      $("chatUsername").value = "";
      setStatus("chatStatus", t("conversationStarted"), "success");
      await loadConversations({force:true, suppressStatus:true});
      if(!contextIsCurrent(context)) return;
      let conversation = hubState.conversations.find(item => item.conversation_id === conversationId);
      if(!conversation){
        conversation = {
          conversation_id: conversationId,
          other_user_id: null,
          other_username: username,
          other_display_name: null,
          other_avatar_path: null,
          other_avatar_revision: 0,
          last_message: null,
          last_message_at: null
        };
        hubState.conversations = [conversation, ...hubState.conversations];
        renderConversations(hubState.conversations);
      }
      await openConversation(conversation);
    } catch(requestError){
      if(contextIsCurrent(context)) setStatus("chatStatus", conversationStartError(requestError), "error");
    } finally {
      if(contextIsCurrent(context)) button.disabled = false;
    }
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
        else renderInsights(hubState.insightRows);
      }
      if(hubState.activeView === "community") renderCommunityFeed(hubState.feed);
      if(hubState.activeView === "community") renderConversationPreview();
      if(hubState.activeView === "messages"){
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
    const offset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-bar-offset")) || 76;
    const top = Math.max(0, hub.getBoundingClientRect().top + window.scrollY - offset);
    window.scrollTo({
      top,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  }));
  $("loadCourseInsights")?.addEventListener("click", loadCourseInsights);
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
    if(event.key === "Enter" && !event.isComposing && event.keyCode !== 229){
      event.preventDefault();
      void startConversation();
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
  window.addEventListener("beforeunload", () => { revokeAvatarUrls(); revokeCommunityMediaUrls(); }, {once:true});

  window.ConCourseHub = {
    show: showHub,
    hide: hideHub,
    switchView,
    openConversationById,
    refreshHeader: renderHubHeader,
    syncAccess,
    syncFinalSchedule,
    requestAction: requestHubAction,
    openProfile: openSchoolmateProfile,
    mediaTools: Object.freeze({normalizeRasterUpload, normalizeRasterToWebP, videoUploadType, validateVideoSignature, wrapMediaUploadError, mediaUploadError}),
    reloadMembership: () => loadMembership(),
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
      window.ConCourseMarketplace?.refreshLanguage();
      window.ConCourseAcademicTools?.refreshLanguage?.();
    }
  };

  syncInsightYearControl();
  switchConnectionTab("verified");
  syncAccess();
})();
