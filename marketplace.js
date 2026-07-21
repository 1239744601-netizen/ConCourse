"use strict";

(() => {
  const PAGE_SIZE = 24;
  const MAX_MEDIA = 8;
  const MARKETPLACE_BUCKET = "marketplace-media";
  const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  const UUID_RE = new RegExp(`^${UUID_PATTERN}$`, "i");
  const LISTING_HASH_RE = new RegExp(`^#listing-(${UUID_PATTERN})$`, "i");
  const MEDIA_PATH_RE = new RegExp(`^${UUID_PATTERN}/listings/${UUID_PATTERN}/${UUID_PATTERN}\\.(?:webp|jpg|png|mp4|webm|mov)$`, "i");

  const CATEGORY_VALUES = ["notes", "past_papers", "textbooks", "electronics", "furniture", "life_essentials", "services", "other"];
  const MODE_VALUES = ["sale", "free", "wanted"];
  const CONDITION_VALUES = ["digital", "new", "like_new", "good", "fair", "used", "not_applicable"];
  const DELIVERY_VALUES = ["digital", "meetup", "shipping"];
  const CURRENCY_VALUES = ["HKD", "CNY", "USD", "GBP", "EUR", "SGD", "AUD", "CAD", "JPY", "KRW"];
  const ORDER_STEPS = ["awaiting_payment", "payment_held", "fulfilled", "accepted"];
  const RIGHTS_ATTESTATION = "I own this item or have permission to distribute it. It is not a leaked/current exam, assessment answer, pirated material, or personal data.";
  const RIGHTS_BASIS_VALUES = ["original", "licensed", "public_domain", "not_applicable"];

  const FALLBACK = Object.freeze({
    marketplaceUnavailable:"Marketplace is temporarily unavailable. Run the latest Supabase setup SQL and try again.",
    marketplaceVerificationRequired:"A verified university membership is required to use the campus marketplace.",
    marketplaceLoading:"Loading your campus marketplace…",
    marketplaceEmpty:"No listings match these filters yet.",
    marketplaceEmptyHint:"Try another search—or add the first useful item for your campus.",
    marketplaceSavedEmptyHint:"Save useful listings and they will stay together here.",
    marketplaceOwnEmptyHint:"Turn something you no longer need into another student's next find.",
    marketplaceOrderEmptyHint:"When you make or receive an order, its progress will appear here.",
    marketplaceGlobalEmptyHint:"Try another university, category, or search.",
    marketplaceResults:"{count} listings",
    marketplaceSavedResults:"{count} saved listings",
    marketplaceMineResults:"{count} of your listings",
    marketplaceOrderResults:"{count} orders",
    marketplaceLoadFailed:"The marketplace could not be loaded.",
    marketplaceMediaUnavailable:"This private marketplace media is unavailable.",
    marketplaceMediaLoading:"Loading media…",
    marketplaceListingUnavailable:"This listing is no longer available.",
    marketplaceNewListing:"Create a listing",
    marketplaceEditListing:"Edit listing",
    marketplaceTitleRequired:"Enter a listing title.",
    marketplaceDescriptionRequired:"Describe the item accurately.",
    marketplacePriceRequired:"Enter a valid price.",
    marketplaceDeliveryRequired:"Choose at least one delivery method.",
    marketplaceRightsRequired:"Confirm that you own this material or have permission to distribute it.",
    marketplaceRightsBasisRequired:"Choose the legal basis that lets you distribute this academic material.",
    marketplacePastPaperRightsRequired:"Past papers must be licensed for redistribution or in the public domain.",
    marketplaceRightsStudy:"Only upload notes you created or materials you are legally allowed to distribute. Do not sell leaked, restricted, or copyrighted exam papers.",
    marketplacePreparingMedia:"Preparing private media…",
    marketplaceMediaLimit:"A listing can contain up to 8 images or videos.",
    marketplaceImageTooLarge:"Images must be smaller than 25 MB.",
    marketplaceVideoTooLarge:"Videos must be smaller than 50 MB.",
    marketplaceMediaInvalid:"Choose a valid raster image, MP4, WebM, or MOV file.",
    marketplaceMediaReady:"Media is ready to upload.",
    marketplaceMediaPartiallyReady:"Valid files were kept; {count} file(s) could not be added.",
    marketplaceSaving:"Saving listing…",
    marketplaceSaved:"Listing saved.",
    marketplaceSaveFailed:"The listing could not be saved.",
    marketplaceEditMediaLocked:"Media cannot be replaced on a published listing. Create a new listing if the media needs to change.",
    marketplaceRemoveMedia:"Remove media",
    marketplaceMediaDescription:"Description for media {number}",
    marketplaceNoMedia:"No media added",
    marketplaceFree:"Free",
    marketplaceWanted:"Wanted",
    marketplaceNegotiable:"Negotiable",
    marketplaceSeller:"Seller",
    marketplaceViewListing:"View listing",
    marketplaceFavorite:"Save",
    marketplaceUnfavorite:"Saved",
    marketplaceShare:"Share",
    marketplaceLinkCopied:"Listing link copied. The viewer must sign in with an eligible campus account.",
    marketplaceShareFailed:"The listing link could not be shared.",
    marketplaceMessageSeller:"Message seller",
    marketplaceMakeOffer:"Make an offer",
    marketplaceOfferAmount:"Enter your offer amount.",
    marketplaceOfferMessage:"Optional message to the seller",
    marketplaceOfferSent:"Offer sent.",
    marketplaceOfferFailed:"The offer could not be sent.",
    marketplaceCheckoutComingSoon:"Protected checkout coming soon",
    marketplaceCheckoutWarning:"Protected checkout and payment holding are not activated. ConCourse does not currently collect, hold, or transfer money. Database order status is only a coordination record—not proof of payment or escrow.",
    marketplaceOrder:"Order",
    marketplaceOrderRoleBuyer:"Buying",
    marketplaceOrderRoleSeller:"Selling",
    marketplaceViewOrder:"View order",
    marketplaceOrderUnavailable:"This order is unavailable.",
    marketplaceAwaitingPayment:"Awaiting payment provider",
    marketplacePaymentHeld:"Payment marked as held",
    marketplaceFulfilled:"Seller marked fulfilled",
    marketplaceAccepted:"Buyer accepted",
    marketplaceDisputed:"Disputed",
    marketplaceCancelled:"Cancelled",
    marketplaceRefunded:"Refunded",
    marketplaceCreated:"Order created",
    marketplacePaymentPending:"Payment confirmation pending",
    marketplacePaymentFailed:"Payment failed",
    marketplaceReleased:"Funds released by payment provider",
    marketplaceMarkFulfilled:"Mark fulfilled",
    marketplaceFulfilmentNote:"Add delivery or handover details for the buyer.",
    marketplaceFulfilledSaved:"Order marked fulfilled.",
    marketplaceAcceptOrder:"Accept and review",
    marketplaceRatingPrompt:"Rate the transaction from 1 to 5.",
    marketplaceReviewPrompt:"Write a short, honest review.",
    marketplaceAcceptedSaved:"Order accepted and review saved.",
    marketplaceOpenDispute:"Report an order problem",
    marketplaceDisputeReason:"Choose a short reason, such as item not received or not as described.",
    marketplaceDisputeDetails:"Describe the problem and keep any evidence. Do not include card or bank details.",
    marketplaceDisputeOpened:"The dispute was recorded for administrator review.",
    marketplaceDisputeRecord:"Dispute record",
    marketplaceReview:"Transaction review",
    marketplaceRating:"Rating: {rating} out of 5",
    marketplaceReport:"Report listing",
    marketplaceReportReason:"Explain what is unsafe, misleading, prohibited, or infringing.",
    marketplaceReported:"Report submitted.",
    marketplaceActionFailed:"That action could not be completed.",
    marketplacePause:"Pause",
    marketplaceActivate:"Activate",
    marketplaceDelete:"Delete",
    marketplaceDeleteConfirm:"Remove this listing from the marketplace? This cannot be undone.",
    marketplaceMarkSold:"Mark sold",
    marketplaceMarkSoldConfirm:"Mark this listing sold only after an offline handover is complete. This closes the listing but does not prove that payment occurred.",
    marketplaceMarkClaimed:"Mark claimed",
    marketplaceMarkClaimedConfirm:"Mark this free item claimed only after the handover is complete.",
    marketplaceCloseRequest:"Close request",
    marketplaceCloseRequestConfirm:"Close this wanted request only when you no longer need the item.",
    marketplaceStatusClaimed:"Claimed",
    marketplaceStatusRequestClosed:"Request closed",
    marketplaceStatusUpdated:"Listing status updated.",
    marketplaceOffers:"Offers",
    marketplaceNoOffers:"No offers yet.",
    marketplaceOffer:"{price} offer",
    marketplaceOfferDisclaimer:"Offers are non-binding price proposals. Use Messages to agree on next steps; ConCourse does not collect payment.",
    marketplaceMessageBuyer:"Message buyer",
    marketplaceDelivery:"Delivery",
    marketplaceCondition:"Condition",
    marketplaceCourse:"Course",
    marketplacePosted:"Posted {date}",
    marketplaceSellerProfile:"View seller profile",
    marketplaceSelectListing:"Link one of your active listings",
    marketplaceStatusDraft:"Draft",
    marketplaceStatusActive:"Active",
    marketplaceStatusReserved:"Reserved",
    marketplaceStatusSold:"Sold",
    marketplaceStatusPaused:"Paused",
    marketplaceStatusDeleted:"Deleted",
    marketplaceStatusOpen:"Open",
    marketplaceStatusUnderReview:"Under review",
    marketplaceStatusResolvedBuyer:"Resolved for buyer",
    marketplaceStatusResolvedSeller:"Resolved for seller",
    marketplaceStatusClosed:"Closed",
    marketplaceNoOrders:"You have no marketplace orders yet.",
    marketplaceNoOwnListings:"You have not created a listing yet.",
    marketplacePollInvalid:"Enter a valid value.",
    marketplaceReach:"Marketplace reach",
    marketplaceCampusScope:"Your campus",
    marketplaceGlobalScope:"Global campuses",
    marketplaceCampusScopeDescription:"Trade with verified students at your university.",
    marketplaceGlobalScopeDescription:"Discover opt-in listings from verified students at universities around the world.",
    marketplaceGlobalLoading:"Exploring the global student marketplace…",
    marketplaceGlobalEmpty:"No global listings match these filters yet.",
    marketplaceGlobalResults:"{count} global listings",
    marketplaceGlobalSavedResults:"{count} saved global listings",
    marketplaceGlobalSearchPlaceholder:"Search universities, notes, textbooks, furniture…",
    marketplaceVerifiedUniversity:"Verified university",
    marketplaceGlobalDiscoveryBoundary:"Browse, save, share, and report opt-in listings from other universities. You can message sellers who allow it; cross-campus offers and payments are not enabled yet.",
    marketplaceGlobalOptIn:"Share this listing with verified students worldwide",
    marketplaceGlobalOptInHint:"Your username, university, listing details, and listing media become visible across the verified campus network. Personal profile details stay private.",
    marketplaceGlobalVisibilityFailed:"The listing was saved for your campus, but global sharing could not be updated. Try editing it again after running the latest Supabase SQL.",
    marketplaceSavedGlobally:"Listing saved and shared with verified students worldwide.",
    marketplaceSavedCampusOnly:"Listing saved for your campus only.",
    marketplaceGlobalSeller:"Verified student seller",
    marketplaceGlobalMessageUnavailable:"This seller is not accepting cross-campus messages.",
    marketplaceEnableMessages:"Enable “Allow verified students to message me” in your Profile before contacting a global seller.",
    marketplaceGlobalConversationStarted:"Conversation started. Opening Messages…",
    edit:"Edit",
    report:"Report",
    loadMore:"Load more",
    loadingMore:"Loading more…"
  });

  const LOCAL_COPY = Object.freeze({
    "zh-CN": Object.freeze({
      marketplaceReach:"市集范围",
      marketplaceCampusScope:"本校校园",
      marketplaceGlobalScope:"全球校园",
      marketplaceCampusScopeDescription:"与本校已验证学生进行校园交易。",
      marketplaceGlobalScopeDescription:"探索全球大学已验证学生主动公开的商品。",
      marketplaceGlobalLoading:"正在探索全球学生市集…",
      marketplaceGlobalEmpty:"目前没有符合筛选条件的全球商品。",
      marketplaceGlobalResults:"{count} 件全球商品",
      marketplaceGlobalSavedResults:"已收藏 {count} 件全球商品",
      marketplaceGlobalSearchPlaceholder:"搜索大学、笔记、课本、家具…",
      marketplaceVerifiedUniversity:"已验证大学",
      marketplaceGlobalDiscoveryBoundary:"可浏览、收藏、分享及举报其他大学主动公开的商品；如卖家允许，也可发送私信。跨校出价及付款暂未开放。",
      marketplaceGlobalOptIn:"向全球已验证学生公开这件商品",
      marketplaceGlobalOptInHint:"你的用户名、大学、商品资料和媒体将向已验证校园网络公开；个人档案资料仍保持私密。",
      marketplaceGlobalVisibilityFailed:"商品已保存至本校市集，但未能更新全球公开设置。请运行最新 Supabase SQL 后再次编辑。",
      marketplaceSavedGlobally:"商品已保存，并向全球已验证学生公开。",
      marketplaceSavedCampusOnly:"商品仅保存至本校市集。",
      marketplaceGlobalSeller:"已验证学生卖家",
      marketplaceGlobalMessageUnavailable:"卖家暂不接收跨校私信。",
      marketplaceEnableMessages:"请先在个人档案开启“允许已验证学生给我发私信”，再联系全球市集卖家。",
      marketplaceGlobalConversationStarted:"对话已建立，正在打开私信…",
      marketplaceEmptyHint:"尝试其他关键词或筛选条件，也可以成为第一个发布校园好物的人。",
      marketplaceSavedEmptyHint:"收藏感兴趣的商品后，它们会集中显示在这里。",
      marketplaceOwnEmptyHint:"把不再需要的物品发布出来，让它成为另一位学生的新发现。",
      marketplaceOrderEmptyHint:"当你创建或收到订单后，交易进度会显示在这里。",
      marketplaceGlobalEmptyHint:"尝试其他大学、分类或搜索关键词。"
    }),
    "zh-HK": Object.freeze({
      marketplaceReach:"市集範圍",
      marketplaceCampusScope:"本校校園",
      marketplaceGlobalScope:"全球校園",
      marketplaceCampusScopeDescription:"同本校已驗證學生進行校園交易。",
      marketplaceGlobalScopeDescription:"探索全球大學已驗證學生主動公開嘅商品。",
      marketplaceGlobalLoading:"正在探索全球學生市集…",
      marketplaceGlobalEmpty:"而家未有符合篩選條件嘅全球商品。",
      marketplaceGlobalResults:"{count} 件全球商品",
      marketplaceGlobalSavedResults:"已收藏 {count} 件全球商品",
      marketplaceGlobalSearchPlaceholder:"搜尋大學、筆記、教科書、傢俬…",
      marketplaceVerifiedUniversity:"已驗證大學",
      marketplaceGlobalDiscoveryBoundary:"可以瀏覽、收藏、分享同舉報其他大學主動公開嘅商品；如果賣家允許，亦可以傳送私訊。跨校出價同付款暫未開放。",
      marketplaceGlobalOptIn:"向全球已驗證學生公開呢件商品",
      marketplaceGlobalOptInHint:"你嘅用戶名、大學、商品資料同媒體會向已驗證校園網絡公開；個人檔案資料仍然保密。",
      marketplaceGlobalVisibilityFailed:"商品已儲存到本校市集，但未能更新全球公開設定。請執行最新 Supabase SQL 後再編輯。",
      marketplaceSavedGlobally:"商品已儲存，並向全球已驗證學生公開。",
      marketplaceSavedCampusOnly:"商品只儲存到本校市集。",
      marketplaceGlobalSeller:"已驗證學生賣家",
      marketplaceGlobalMessageUnavailable:"賣家暫時唔接收跨校私訊。",
      marketplaceEnableMessages:"請先喺個人檔案開啟「允許已驗證學生私訊我」，再聯絡全球市集賣家。",
      marketplaceGlobalConversationStarted:"對話已建立，正在打開私訊…",
      marketplaceEmptyHint:"試下其他關鍵字或篩選條件，亦可以成為第一個發佈校園好物嘅人。",
      marketplaceSavedEmptyHint:"收藏感興趣嘅商品之後，佢哋會集中顯示喺呢度。",
      marketplaceOwnEmptyHint:"將唔再需要嘅物品發佈出嚟，等佢成為另一位學生嘅新發現。",
      marketplaceOrderEmptyHint:"當你建立或者收到訂單之後，交易進度會顯示喺呢度。",
      marketplaceGlobalEmptyHint:"試下其他大學、分類或者搜尋關鍵字。"
    })
  });

  const state = {
    userId:null,
    generation:0,
    active:false,
    scope:"campus",
    mode:"discover",
    query:"",
    category:"all",
    sort:"recent",
    offset:0,
    hasMore:false,
    total:null,
    items:[],
    localItems:[],
    loading:false,
    feedRequest:0,
    detailRequest:0,
    orderRequest:0,
    pickerRequest:0,
    editorOperation:0,
    busyListings:new Set(),
    busyOrders:new Set(),
    detail:null,
    order:null,
    returnFocus:null,
    orderReturnFocus:null,
    editorReturnFocus:null,
    editorListing:null,
    editorMedia:[],
    editorBusy:false,
    selectedCommunityListing:null,
    ownListings:[],
    imageUrls:new Map(),
    mediaLoads:new Map(),
    videoUrls:new Map(),
    searchTimer:null
  };

  const mediaObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const action = entry.isIntersecting ? entry.target._loadMarketplaceMedia : entry.target._unloadMarketplaceMedia;
          if(typeof action === "function") action();
        });
      }, {rootMargin:"900px 0px"})
    : null;
  const mediaRemovalObserver = typeof MutationObserver === "function"
    ? new MutationObserver(records => {
        records.forEach(record => record.removedNodes.forEach(removed => {
          if(!(removed instanceof Element)) return;
          const holders = [];
          if(removed.matches("[data-marketplace-media-holder]")) holders.push(removed);
          holders.push(...removed.querySelectorAll("[data-marketplace-media-holder]"));
          holders.forEach(holder => {
            mediaObserver?.unobserve(holder);
            if(typeof holder._unloadMarketplaceMedia === "function") holder._unloadMarketplaceMedia();
            delete holder._loadMarketplaceMedia;
            delete holder._unloadMarketplaceMedia;
          });
        }));
      })
    : null;
  mediaRemovalObserver?.observe(document.documentElement, {childList:true, subtree:true});

  const byId = id => typeof $ === "function" ? $(id) : document.getElementById(id);
  const canRestoreFocus = target => !!(
    target instanceof HTMLElement
    && target.isConnected
    && !target.hidden
    && !target.disabled
    && !target.closest("[hidden], [inert], [aria-hidden='true']")
  );
  const element = (tag, className="", text="") => {
    const result = document.createElement(tag);
    if(className) result.className = className;
    if(text !== "") result.textContent = String(text);
    return result;
  };
  const replaceVariables = (value, variables={}) => String(value).replace(/\{(\w+)\}/g, (_match, key) => String(variables[key] ?? ""));
  const tr = (key, variables={}) => {
    let translated = key;
    try { if(typeof t === "function") translated = t(key, variables); }
    catch(_error){}
    if(translated && translated !== key) return translated;
    const language = typeof currentLanguage === "string" ? currentLanguage : document.documentElement.lang;
    const local = LOCAL_COPY[language]?.[key];
    return replaceVariables(local || FALLBACK[key] || key, variables);
  };
  const parseJson = (value, fallback) => {
    if(value === null || value === undefined) return fallback;
    if(typeof value === "string"){
      try { return JSON.parse(value); }
      catch(_error){ return fallback; }
    }
    return value;
  };
  const firstObject = value => Array.isArray(value) ? (value[0] || null) : value;
  const collection = value => {
    const parsed = parseJson(value, value);
    if(Array.isArray(parsed)) return {items:parsed, hasMore:false, total:parsed.length};
    if(!parsed || typeof parsed !== "object") return {items:[], hasMore:false, total:0};
    const items = [parsed.items, parsed.listings, parsed.orders, parsed.rows].find(Array.isArray) || [];
    return {
      items,
      hasMore:parsed.has_more === true || parsed.hasMore === true,
      total:Number.isFinite(Number(parsed.total)) ? Number(parsed.total) : null,
      envelope:parsed
    };
  };
  const listingId = listing => String(listing?.listing_id || listing?.id || "");
  const orderId = order => String(order?.order_id || order?.id || "");
  const listingRecord = value => {
    const row = firstObject(parseJson(value, value));
    if(!row || typeof row !== "object") return null;
    if(row.listing && typeof row.listing === "object"){
      return {...row.listing, seller:row.seller || row.listing.seller, media:row.media || row.listing.media, viewer:row.viewer, offers:row.offers};
    }
    return row;
  };
  const orderRecord = value => {
    const row = firstObject(parseJson(value, value));
    if(!row || typeof row !== "object") return null;
    if(row.order && typeof row.order === "object"){
      return {
        ...row.order,
        listing:row.listing || parseJson(row.order.listing_snapshot, null),
        buyer:row.buyer || row.order.buyer,
        seller:row.seller || row.order.seller,
        events:row.events,
        dispute:row.dispute,
        review:row.review
      };
    }
    return row;
  };
  const currentContext = () => ({generation:state.generation, userId:typeof currentUser !== "undefined" ? currentUser?.id || null : null});
  const contextIsCurrent = context => !!(
    context?.userId && context.userId === state.userId && context.generation === state.generation
    && typeof currentUser !== "undefined" && currentUser?.id === context.userId
  );
  const hub = () => window.ConCourseHub || {};
  const marketplaceVisible = () => {
    const view = document.querySelector('[data-hub-view="marketplace"]');
    return !!(view && !view.hidden);
  };

  function ensureScopeControls(){
    const view = document.querySelector('[data-hub-view="marketplace"]');
    const discovery = view?.querySelector(".market-discovery-bar");
    if(!view || !discovery || byId("marketplaceScope")) return;
    const scope = element("div", "market-scope", "");
    scope.id = "marketplaceScope";
    scope.setAttribute("role", "group");
    const choices = element("div", "market-scope-choices");
    [
      ["campus", "marketplaceCampusScope"],
      ["global", "marketplaceGlobalScope"]
    ].forEach(([value, key]) => {
      const button = element("button", "market-scope-button", tr(key));
      button.type = "button";
      button.dataset.marketScope = value;
      button.setAttribute("aria-pressed", value === state.scope ? "true" : "false");
      choices.append(button);
    });
    const description = element("p", "market-scope-description");
    description.id = "marketplaceScopeDescription";
    scope.append(choices, description);
    discovery.before(scope);
  }

  function ensureGlobalVisibilityControl(){
    const form = byId("marketplaceListingEditorForm");
    const status = byId("marketplaceEditorStatus");
    if(!form || !status || byId("marketplaceGlobalVisibilityInput")) return;
    const label = element("label", "marketplace-check-row marketplace-global-visibility-check");
    label.id = "marketplaceGlobalVisibilityField";
    const input = element("input");
    input.id = "marketplaceGlobalVisibilityInput";
    input.type = "checkbox";
    const copy = element("span", "marketplace-global-visibility-copy");
    copy.append(
      element("b", "", tr("marketplaceGlobalOptIn")),
      element("small", "", tr("marketplaceGlobalOptInHint"))
    );
    label.append(input, copy);
    status.before(label);
  }

  function syncGlobalVisibilityCopy(){
    const copy = byId("marketplaceGlobalVisibilityField")?.querySelector(".marketplace-global-visibility-copy");
    if(!copy) return;
    copy.replaceChildren(
      element("b", "", tr("marketplaceGlobalOptIn")),
      element("small", "", tr("marketplaceGlobalOptInHint"))
    );
  }

  function syncScopeUi(){
    ensureScopeControls();
    const global = state.scope === "global";
    const view = document.querySelector('[data-hub-view="marketplace"]');
    if(view) view.dataset.marketScope = state.scope;
    const memberHub = byId("memberHub");
    if(memberHub) memberHub.dataset.marketplaceScope = state.scope;
    const scope = byId("marketplaceScope");
    if(scope) scope.setAttribute("aria-label", tr("marketplaceReach"));
    document.querySelectorAll("#marketplaceScope [data-market-scope]").forEach(button => {
      const active = button.dataset.marketScope === state.scope;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.textContent = tr(button.dataset.marketScope === "global" ? "marketplaceGlobalScope" : "marketplaceCampusScope");
    });
    const description = byId("marketplaceScopeDescription");
    if(description) description.textContent = tr(global ? "marketplaceGlobalScopeDescription" : "marketplaceCampusScopeDescription");
    document.querySelectorAll('[data-market-action="sell"]').forEach(sell => {
      sell.hidden = global;
      sell.disabled = global;
    });
    document.querySelectorAll('#marketplaceModes [data-market-mode="mine"], #marketplaceModes [data-market-mode="orders"]').forEach(button => {
      button.hidden = global;
      button.disabled = global;
    });
    const searchCopy = tr(global ? "marketplaceGlobalSearchPlaceholder" : "marketplaceSearchPlaceholder");
    const search = byId("marketplaceSearch");
    if(search){ search.placeholder = searchCopy; search.setAttribute("aria-label", searchCopy); }
    const searchLabel = byId("marketplaceSearchLabel");
    if(searchLabel) searchLabel.textContent = searchCopy;
    const trust = view?.querySelector(".market-trust-strip");
    if(trust){
      const title = trust.querySelector("b");
      const detail = trust.querySelector("span");
      if(title) title.textContent = tr(global ? "marketplaceGlobalScope" : "marketplaceCampusOnly");
      if(detail) detail.textContent = tr(global ? "marketplaceGlobalDiscoveryBoundary" : "marketplacePaymentBoundary");
    }
    if(typeof hub().refreshHeader === "function") hub().refreshHeader();
  }

  async function setScope(scope){
    if(!["campus", "global"].includes(scope) || scope === state.scope) return;
    closeDetail({restoreFocus:false, clearHash:true});
    state.scope = scope;
    if(scope === "global" && ["mine", "orders"].includes(state.mode)) state.mode = "discover";
    state.items = [];
    state.localItems = [];
    state.offset = 0;
    state.hasMore = false;
    state.total = null;
    syncScopeUi();
    await setMode(state.mode);
  }

  function setStatus(message="", kind=""){
    const target = byId("marketplaceStatus");
    if(!target) return;
    target.textContent = message;
    target.className = `hub-inline-status marketplace-status${kind ? ` ${kind}` : ""}`;
  }

  function featureError(error){
    const message = String(error?.message || error || "");
    if(/Enable Allow messages/i.test(message)) return tr("marketplaceEnableMessages");
    if(/seller is not accepting messages/i.test(message)) return tr("marketplaceGlobalMessageUnavailable");
    if(/verified.*membership|membership.*verified|school verification/i.test(message)) return tr("marketplaceVerificationRequired");
    if(/Could not find the function|schema cache|does not exist|PGRST202|relation .* does not exist/i.test(message)) return tr("marketplaceUnavailable");
    if(/not available|unavailable|not found/i.test(message)) return tr("marketplaceListingUnavailable");
    if(/Please wait|rate limit/i.test(message)) return tr("rateLimited");
    return tr("marketplaceActionFailed");
  }

  function locale(){
    const language = typeof currentLanguage === "string" ? currentLanguage : document.documentElement.lang;
    return language === "zh-CN" ? "zh-CN" : language === "zh-HK" ? "zh-HK" : "en-HK";
  }

  function formatDate(value){
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(locale(), {dateStyle:"medium", timeStyle:"short"});
  }

  function formatMoney(minor, currency="HKD"){
    const code = CURRENCY_VALUES.includes(String(currency).toUpperCase()) ? String(currency).toUpperCase() : "HKD";
    const amount = Number(minor || 0) / (code === "JPY" || code === "KRW" ? 1 : 100);
    try { return new Intl.NumberFormat(locale(), {style:"currency", currency:code, maximumFractionDigits:code === "JPY" || code === "KRW" ? 0 : 2}).format(amount); }
    catch(_error){ return `${code} ${amount.toFixed(2)}`; }
  }

  function labelFor(prefix, value){
    if(!value) return "";
    const exactKeys = {
      marketplaceCategoryNotes:"marketplaceNotes",
      marketplaceCategoryPastPapers:"marketplacePastPapers",
      marketplaceCategoryTextbooks:"marketplaceTextbooks",
      marketplaceCategoryElectronics:"marketplaceElectronics",
      marketplaceCategoryFurniture:"marketplaceFurniture",
      marketplaceCategoryLifeEssentials:"marketplaceLifeEssentials",
      marketplaceCategoryServices:"marketplaceServices",
      marketplaceCategoryOther:"marketplaceOther",
      marketplaceDeliveryDigital:"marketplaceDigitalDelivery",
      marketplaceDeliveryMeetup:"marketplaceCampusMeetup",
      marketplaceDeliveryShipping:"marketplaceShipping"
    };
    const generated = `${prefix}${String(value).split("_").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join("")}`;
    const key = exactKeys[generated] || generated;
    const translated = tr(key);
    return translated === key ? String(value).replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase()) : translated;
  }

  function normalizeMedia(value){
    const parsed = parseJson(value, []);
    return (Array.isArray(parsed) ? parsed : []).filter(item => {
      const path = String(item?.storage_path || "");
      const kind = String(item?.media_type || item?.kind || "");
      return MEDIA_PATH_RE.test(path) && ["image", "video"].includes(kind);
    }).sort((a, b) => Number(a.position || 0) - Number(b.position || 0)).slice(0, MAX_MEDIA);
  }

  function normalizeSeller(listing){
    const source = listing?.seller && typeof listing.seller === "object" ? listing.seller : listing || {};
    return {
      userId:String(source.user_id || source.seller_id || listing?.seller_id || ""),
      username:String(source.username || listing?.seller_username || ""),
      displayName:String(source.display_name || listing?.seller_display_name || source.username || listing?.seller_username || tr("anonymousStudent"))
    };
  }

  function isCrossCampusListing(listing){
    return !!(
      listing?._crossCampus
      || listing?.is_cross_school === true
      || listing?.viewer?.is_cross_school === true
      || (state.scope === "global" && listing?.global_visible === true)
    );
  }

  function listingUniversityName(listing){
    return String(listing?.school_name || listing?.university_name || "").trim().slice(0, 180);
  }

  function universityContext(listing, {compact=false}={}){
    const schoolName = listingUniversityName(listing);
    if(!schoolName) return null;
    const context = element("div", compact ? "marketplace-university-context compact" : "marketplace-university-context");
    const mark = element("span", "marketplace-university-mark", "◎");
    mark.setAttribute("aria-hidden", "true");
    const copy = element("span", "marketplace-university-copy");
    copy.append(
      element("small", "", tr("marketplaceVerifiedUniversity")),
      element("strong", "", schoolName)
    );
    context.append(mark, copy);
    return context;
  }

  function isOwnListing(listing){
    return normalizeSeller(listing).userId === state.userId || String(listing?.seller_id || "") === state.userId || listing?.viewer?.is_owner === true || listing?.is_owner === true;
  }

  function getListingMode(listing){ return String(listing?.mode || listing?.listing_mode || "sale"); }
  function getListingPrice(listing){ return Number(listing?.price_minor || 0); }

  function revokeMediaUrls(){
    unloadRenderedMedia(document);
    state.imageUrls.forEach(entry => URL.revokeObjectURL(entry.url));
    state.imageUrls.clear();
    state.mediaLoads.clear();
    state.videoUrls.clear();
  }

  function unloadRenderedMedia(root){
    root?.querySelectorAll?.("[data-marketplace-media-holder]").forEach(holder => {
      mediaObserver?.unobserve(holder);
      if(typeof holder._unloadMarketplaceMedia === "function") holder._unloadMarketplaceMedia();
      delete holder._loadMarketplaceMedia;
      delete holder._unloadMarketplaceMedia;
    });
  }

  async function imageUrl(path){
    if(!MEDIA_PATH_RE.test(path) || !authClient || !state.userId) return "";
    const cached = state.imageUrls.get(path);
    if(cached?.url) return cached.url;
    const key = `image:${path}`;
    if(state.mediaLoads.has(key)) return state.mediaLoads.get(key);
    const context = currentContext();
    const pending = authClient.storage.from(MARKETPLACE_BUCKET).download(path).then(({data, error}) => {
      if(error || !data) throw error || new Error(tr("marketplaceMediaUnavailable"));
      const url = URL.createObjectURL(data);
      if(!contextIsCurrent(context)){ URL.revokeObjectURL(url); return ""; }
      const entry = {url, consumers:new Set()};
      state.imageUrls.set(path, entry);
      const cleanDetachedConsumers = () => {
        if(state.imageUrls.get(path) !== entry) return;
        entry.consumers.forEach(holder => { if(!holder.isConnected) entry.consumers.delete(holder); });
        if(entry.consumers.size === 0){
          URL.revokeObjectURL(entry.url);
          state.imageUrls.delete(path);
        } else window.setTimeout(cleanDetachedConsumers, 60_000);
      };
      window.setTimeout(cleanDetachedConsumers, 0);
      return url;
    }).finally(() => state.mediaLoads.delete(key));
    state.mediaLoads.set(key, pending);
    return pending;
  }

  function retainImage(path, url, holder){
    const entry = state.imageUrls.get(path);
    if(!entry || entry.url !== url) return false;
    entry.consumers.add(holder);
    return true;
  }

  function releaseImage(path, holder){
    const entry = state.imageUrls.get(path);
    if(!entry) return;
    entry.consumers.delete(holder);
    if(entry.consumers.size === 0){
      URL.revokeObjectURL(entry.url);
      state.imageUrls.delete(path);
    }
  }

  async function videoUrl(path, force=false){
    if(!MEDIA_PATH_RE.test(path) || !authClient || !state.userId) return "";
    const cached = state.videoUrls.get(path);
    if(!force && cached?.url && cached.expiresAt > Date.now() + 45_000) return cached.url;
    const key = `video:${path}`;
    if(state.mediaLoads.has(key)) return state.mediaLoads.get(key);
    const context = currentContext();
    const pending = authClient.storage.from(MARKETPLACE_BUCKET).createSignedUrl(path, 3600).then(({data, error}) => {
      if(error || !data?.signedUrl) throw error || new Error(tr("marketplaceMediaUnavailable"));
      if(!contextIsCurrent(context)) return "";
      const result = {url:data.signedUrl, expiresAt:Date.now() + 3_540_000};
      state.videoUrls.set(path, result);
      return result.url;
    }).finally(() => state.mediaLoads.delete(key));
    state.mediaLoads.set(key, pending);
    return pending;
  }

  function privateMedia(mediaItem, options={}){
    const holder = element("div", options.compact ? "marketplace-media marketplace-media-compact" : "marketplace-media");
    holder.dataset.marketplaceMediaHolder = "";
    const placeholder = element("span", "marketplace-media-placeholder", tr("marketplaceMediaLoading"));
    holder.append(placeholder);
    const path = String(mediaItem?.storage_path || "");
    const kind = String(mediaItem?.media_type || "image");
    let wanted = false;
    let loading = false;
    let retained = false;
    let videoRetryUsed = false;

    const unload = () => {
      wanted = false;
      const image = holder.querySelector("img");
      const video = holder.querySelector("video");
      if(image) image.removeAttribute("src");
      if(video){ video.pause(); video.removeAttribute("src"); video.load(); }
      if(retained){ releaseImage(path, holder); retained = false; }
      if(!holder.querySelector(".marketplace-media-placeholder")) holder.replaceChildren(element("span", "marketplace-media-placeholder", tr("marketplaceMediaLoading")));
    };
    const load = async force => {
      wanted = true;
      if(loading || !contextIsCurrent(options.context || currentContext())) return;
      loading = true;
      try {
        if(kind === "video"){
          const url = await videoUrl(path, force === true);
          if(!wanted || !url) return;
          const video = element("video");
          video.controls = options.controls !== false;
          video.preload = "metadata";
          video.playsInline = true;
          video.setAttribute("aria-label", String(mediaItem.alt_text || tr("postVideo")));
          video.src = url;
          video.addEventListener("error", () => {
            if(wanted && !videoRetryUsed){ videoRetryUsed = true; void load(true); }
          }, {once:true});
          holder.replaceChildren(video);
        } else {
          const url = await imageUrl(path);
          if(!wanted || !url) return;
          retained = retainImage(path, url, holder);
          if(!retained) return;
          const image = element("img");
          image.alt = String(mediaItem.alt_text || "");
          image.loading = "lazy";
          image.decoding = "async";
          image.src = url;
          holder.replaceChildren(image);
        }
      } catch(_error){
        if(wanted) holder.replaceChildren(element("span", "marketplace-media-placeholder error", tr("marketplaceMediaUnavailable")));
      } finally { loading = false; }
    };
    holder._loadMarketplaceMedia = () => void load(false);
    holder._unloadMarketplaceMedia = unload;
    if(mediaObserver) mediaObserver.observe(holder);
    else void load(false);
    return holder;
  }

  function listingPrice(listing){
    const mode = getListingMode(listing);
    if(mode === "free") return tr("marketplaceFree");
    const amount = formatMoney(getListingPrice(listing), listing?.currency);
    return mode === "wanted" ? `${tr("marketplaceWanted")} · ${amount}` : amount;
  }

  function listingStatusLabel(listing){
    const status = String(listing?.status || "active");
    if(status === "sold" && getListingMode(listing) === "free") return tr("marketplaceStatusClaimed");
    if(status === "sold" && getListingMode(listing) === "wanted") return tr("marketplaceStatusRequestClosed");
    return labelFor("marketplaceStatus", status);
  }

  function sellerButton(listing){
    const seller = normalizeSeller(listing);
    if(isCrossCampusListing(listing)){
      const label = element("span", "marketplace-global-seller", seller.username ? `@${seller.username}` : tr("marketplaceGlobalSeller"));
      label.title = tr("marketplaceGlobalSeller");
      return label;
    }
    const button = element("button", "marketplace-seller-button", seller.displayName);
    button.type = "button";
    button.setAttribute("aria-label", `${tr("marketplaceSellerProfile")}: ${seller.displayName}`);
    button.disabled = !seller.userId;
    button.addEventListener("click", event => {
      event.stopPropagation();
      if(seller.userId && typeof hub().openProfile === "function") hub().openProfile(seller.userId, button);
    });
    return button;
  }

  function listingCard(listing, options={}){
    const id = listingId(listing);
    const card = element("article", options.compact ? "marketplace-card marketplace-card-compact" : "marketplace-card");
    card.dataset.listingId = id;
    const media = normalizeMedia(listing.media);
    const mediaButton = element("button", "marketplace-card-media-button");
    mediaButton.type = "button";
    mediaButton.setAttribute("aria-label", `${tr("marketplaceViewListing")}: ${String(listing.title || "")}`);
    if(media[0]) mediaButton.append(privateMedia(media[0], {compact:true, context:currentContext(), controls:false}));
    else mediaButton.append(element("span", "marketplace-card-media-empty", labelFor("marketplaceCategory", listing.category)));
    mediaButton.addEventListener("click", () => void openListing(id, mediaButton));
    card.append(mediaButton);

    const body = element("div", "marketplace-card-body");
    const eyebrow = element("div", "marketplace-card-eyebrow");
    eyebrow.append(element("span", "marketplace-category-chip", labelFor("marketplaceCategory", listing.category)));
    if(listing.status && listing.status !== "active") eyebrow.append(element("span", `marketplace-status-chip status-${String(listing.status)}`, listingStatusLabel(listing)));
    body.append(eyebrow);
    const titleButton = element("button", "marketplace-card-title", String(listing.title || tr("marketplaceListingUnavailable")));
    titleButton.type = "button";
    titleButton.addEventListener("click", () => void openListing(id, titleButton));
    body.append(titleButton);
    const schoolContext = isCrossCampusListing(listing) ? universityContext(listing, {compact:true}) : null;
    if(schoolContext) body.append(schoolContext);
    body.append(element("strong", "marketplace-card-price", listingPrice(listing)));
    const meta = element("div", "marketplace-card-meta");
    meta.append(sellerButton(listing));
    if(listing.condition) meta.append(element("span", "", labelFor("marketplaceCondition", listing.condition)));
    body.append(meta);
    const actions = element("div", "marketplace-card-actions");
    if(isOwnListing(listing)){
      if(["draft", "active", "paused"].includes(String(listing.status))){
        const edit = element("button", "marketplace-card-action", tr("edit"));
        edit.type = "button";
        edit.addEventListener("click", () => void openListingEditor(listing, edit));
        actions.append(edit);
      }
    } else {
      const favorite = element("button", `marketplace-card-action${listing.favorited_by_me || listing.viewer?.favorited ? " active" : ""}`, listing.favorited_by_me || listing.viewer?.favorited ? tr("marketplaceUnfavorite") : tr("marketplaceFavorite"));
      favorite.type = "button";
      favorite.setAttribute("aria-pressed", listing.favorited_by_me || listing.viewer?.favorited ? "true" : "false");
      favorite.addEventListener("click", () => void toggleFavorite(id, favorite));
      actions.append(favorite);
    }
    const share = element("button", "marketplace-card-action", tr("marketplaceShare"));
    share.type = "button";
    share.addEventListener("click", () => void shareListing(id, listing.title));
    actions.append(share);
    body.append(actions);
    card.append(body);
    return card;
  }

  function updateResultsLabel(count=state.items.length){
    const target = byId("marketplaceResultsLabel");
    if(!target) return;
    const key = state.scope === "global"
      ? state.mode === "saved" ? "marketplaceGlobalSavedResults" : "marketplaceGlobalResults"
      : state.mode === "saved" ? "marketplaceSavedResults" : state.mode === "mine" ? "marketplaceMineResults" : state.mode === "orders" ? "marketplaceOrderResults" : "marketplaceResults";
    target.textContent = tr(key, {count:state.total ?? count});
  }

  function updateLoadMore(){
    const button = byId("marketplaceLoadMore");
    if(!button) return;
    button.hidden = !state.hasMore;
    button.disabled = state.loading;
    button.textContent = state.loading ? tr("loadingMore") : tr("loadMore");
  }

  function emptyState(message){
    const empty = element("div", "marketplace-empty");
    const visual = element("span", "marketplace-empty-visual");
    visual.setAttribute("aria-hidden", "true");
    visual.append(element("i", "marketplace-empty-orbit"));

    const copy = element("div", "marketplace-empty-content");
    copy.append(element("h3", "", message));
    const hintKey = state.scope === "global"
      ? "marketplaceGlobalEmptyHint"
      : state.mode === "saved"
        ? "marketplaceSavedEmptyHint"
        : state.mode === "mine"
          ? "marketplaceOwnEmptyHint"
          : state.mode === "orders"
            ? "marketplaceOrderEmptyHint"
            : "marketplaceEmptyHint";
    copy.append(element("p", "", tr(hintKey)));

    const filtersApply = !["mine", "orders"].includes(state.mode);
    const filtered = filtersApply && Boolean(state.query || state.category !== "all");
    const actionType = !filtered && state.scope === "campus"
      ? ["discover", "mine"].includes(state.mode)
        ? "sell"
        : ["saved", "orders"].includes(state.mode)
          ? "explore"
          : ""
      : "";
    if(actionType){
      const action = element("button", "hub-marketplace-action primary marketplace-empty-action", tr(actionType === "sell" ? "marketplaceSell" : "marketplaceDiscover"));
      action.type = "button";
      action.dataset.marketAction = actionType;
      action.setAttribute("aria-controls", actionType === "sell" ? "marketplaceListingEditorModal" : "marketplaceCatalogue");
      if(actionType === "sell") action.setAttribute("aria-haspopup", "dialog");
      copy.append(action);
    }

    empty.append(visual, copy);
    return empty;
  }

  function renderMarketplaceLoading(){
    const grid = byId("marketplaceGrid");
    if(!grid) return;
    unloadRenderedMedia(grid);
    const loading = element("div", "marketplace-loading");
    loading.setAttribute("aria-hidden", "true");
    loading.append(element("span", "marketplace-loading-orbit"));
    grid.replaceChildren(loading);
    const catalogue = byId("marketplaceCatalogue");
    if(catalogue){
      catalogue.dataset.empty = "true";
      catalogue.dataset.feedState = "loading";
    }
  }

  function renderMarketplaceError(message){
    const grid = byId("marketplaceGrid");
    if(!grid) return;
    unloadRenderedMedia(grid);
    const error = element("div", "marketplace-feed-error");
    error.setAttribute("aria-hidden", "true");
    error.append(element("span", "marketplace-feed-error-mark", "!"), element("strong", "", message));
    grid.replaceChildren(error);
    state.total = null;
    updateResultsLabel(0);
    updateLoadMore();
    const catalogue = byId("marketplaceCatalogue");
    if(catalogue){
      catalogue.dataset.empty = "true";
      catalogue.dataset.feedState = "error";
    }
  }

  function renderGrid(){
    const grid = byId("marketplaceGrid");
    if(!grid) return;
    unloadRenderedMedia(grid);
    grid.replaceChildren();
    const catalogue = byId("marketplaceCatalogue");
    if(catalogue){
      catalogue.dataset.empty = state.items.length ? "false" : "true";
      catalogue.dataset.feedState = "ready";
    }
    if(state.mode === "orders"){
      state.items.forEach(order => grid.append(orderCard(order)));
      if(!state.items.length) grid.append(emptyState(tr("marketplaceNoOrders")));
    } else {
      state.items.forEach(listing => grid.append(listingCard(listing)));
      if(!state.items.length) grid.append(emptyState(state.scope === "global" ? tr("marketplaceGlobalEmpty") : state.mode === "mine" ? tr("marketplaceNoOwnListings") : tr("marketplaceEmpty")));
    }
    updateResultsLabel();
    updateLoadMore();
  }

  function feedParams(){
    return {
      p_limit:PAGE_SIZE,
      p_offset:state.offset,
      p_query:state.query || null,
      p_category:state.category === "all" ? null : state.category,
      p_mode:state.mode === "saved" ? "saved" : null,
      p_sort:state.sort || "recent"
    };
  }

  async function loadMarketplace({append=false, force=false}={}){
    if(!authClient || !state.userId || state.loading && !force) return;
    const context = currentContext();
    const request = ++state.feedRequest;
    state.loading = true;
    const catalogue = byId("marketplaceCatalogue");
    catalogue?.setAttribute("aria-busy", "true");
    if(catalogue) catalogue.dataset.feedState = "loading";
    if(!append){ state.offset = 0; state.hasMore = false; }
    setStatus(tr(state.scope === "global" ? "marketplaceGlobalLoading" : "marketplaceLoading"));
    updateLoadMore();
    try {
      let response;
      if(state.scope === "global") response = await authClient.rpc("get_global_marketplace_feed", feedParams());
      else if(state.mode === "mine") response = await authClient.rpc("get_my_marketplace_listings");
      else if(state.mode === "orders") response = await authClient.rpc("get_my_marketplace_orders");
      else response = await authClient.rpc("get_marketplace_feed", feedParams());
      if(!contextIsCurrent(context) || request !== state.feedRequest) return;
      if(response.error) throw response.error;
      const result = collection(response.data);
      const incoming = result.items.filter(item => state.mode === "orders" ? UUID_RE.test(orderId(item)) : UUID_RE.test(listingId(item)));
      if(state.scope === "global") incoming.forEach(item => { item._crossCampus = true; });
      if(["mine", "orders"].includes(state.mode)){
        state.localItems = incoming;
        state.items = incoming.slice(0, PAGE_SIZE);
        state.hasMore = state.items.length < incoming.length;
        state.total = incoming.length;
      } else {
        state.localItems = [];
        state.items = append ? [...state.items, ...incoming] : incoming;
        state.hasMore = result.hasMore;
        state.total = result.total;
      }
      state.offset = state.items.length;
      if(state.mode === "mine") state.ownListings = incoming;
      renderGrid();
      setStatus("");
    } catch(error){
      if(contextIsCurrent(context) && request === state.feedRequest){
        const message = featureError(error) || tr("marketplaceLoadFailed");
        if(!append){
          state.items = [];
          renderMarketplaceError(message);
        } else if(catalogue) catalogue.dataset.feedState = "ready";
        setStatus(message, "error");
      }
    } finally {
      if(contextIsCurrent(context) && request === state.feedRequest){
        state.loading = false;
        byId("marketplaceCatalogue")?.setAttribute("aria-busy", "false");
        updateLoadMore();
      }
    }
  }

  function loadNextLocalPage(){
    if(!["mine", "orders"].includes(state.mode) || !state.hasMore) return;
    state.items = state.localItems.slice(0, state.items.length + PAGE_SIZE);
    state.offset = state.items.length;
    state.hasMore = state.items.length < state.localItems.length;
    renderGrid();
  }

  async function setMode(mode){
    if(!["discover", "saved", "mine", "orders"].includes(mode)) mode = "discover";
    if(state.scope === "global" && ["mine", "orders"].includes(mode)) mode = "discover";
    state.mode = mode;
    state.items = [];
    state.localItems = [];
    state.offset = 0;
    state.hasMore = false;
    state.total = null;
    document.querySelectorAll("#marketplaceModes [data-market-mode]").forEach(button => {
      const active = button.dataset.marketMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
      if(active && button.id) byId("marketplaceCatalogue")?.setAttribute("aria-labelledby", button.id);
    });
    renderMarketplaceLoading();
    updateResultsLabel(0);
    updateLoadMore();
    const filtersDisabled = ["mine", "orders"].includes(mode);
    if(byId("marketplaceSearch")) byId("marketplaceSearch").disabled = filtersDisabled;
    if(byId("marketplaceCategory")) byId("marketplaceCategory").disabled = filtersDisabled;
    if(byId("marketplaceSort")) byId("marketplaceSort").disabled = filtersDisabled;
    await loadMarketplace({force:true});
  }

  async function toggleFavorite(id, button){
    if(!UUID_RE.test(id) || state.busyListings.has(id)) return;
    const context = currentContext();
    const restoreFocus = document.activeElement === button;
    const detailFocus = !!button?.closest("#marketplaceDetailContent");
    const originalCard = button?.closest("[data-listing-id]");
    const originalCardIndex = originalCard ? [...document.querySelectorAll("#marketplaceGrid [data-listing-id]")].indexOf(originalCard) : -1;
    state.busyListings.add(id);
    if(button) button.disabled = true;
    try {
      const {data, error} = await authClient.rpc("toggle_marketplace_favorite", {p_listing_id:id});
      if(!contextIsCurrent(context)) return;
      if(error) throw error;
      const result = firstObject(parseJson(data, data)) || {};
      const favorite = result.favorited === true || result.is_favorite === true;
      state.items.forEach(item => {
        if(listingId(item) === id){ item.favorited_by_me = favorite; if(item.viewer) item.viewer.favorited = favorite; }
      });
      if(state.detail && listingId(state.detail) === id){ state.detail.favorited_by_me = favorite; if(state.detail.viewer) state.detail.viewer.favorited = favorite; }
      if(state.mode === "saved" && !favorite){
        state.items = state.items.filter(item => listingId(item) !== id);
        if(Number.isFinite(state.total)) state.total = Math.max(0, state.total - 1);
      }
      renderGrid();
      if(state.detail && listingId(state.detail) === id) renderListingDetail(state.detail);
      if(restoreFocus){
        const replacement = detailFocus
          ? byId("marketplaceDetailContent")?.querySelector(".marketplace-detail-actions [aria-pressed]")
          : document.querySelector(`[data-listing-id="${id}"] .marketplace-card-action[aria-pressed]`)
            || [...document.querySelectorAll("#marketplaceGrid [data-listing-id] .marketplace-card-title")][Math.max(0, originalCardIndex)]
            || document.querySelector("#marketplaceModes [aria-selected='true']");
        requestAnimationFrame(() => replacement?.focus());
      }
    } catch(error){ if(contextIsCurrent(context)) setStatus(featureError(error), "error"); }
    finally { if(contextIsCurrent(context)){ state.busyListings.delete(id); if(button?.isConnected) button.disabled = false; } }
  }

  async function shareListing(id, title=""){
    if(!UUID_RE.test(String(id))) return false;
    const url = new URL(window.location.href);
    url.hash = `listing-${id}`;
    const data = {title:String(title || "ConCourse marketplace"), text:String(title || "ConCourse campus marketplace"), url:url.toString()};
    try {
      if(typeof navigator.share === "function") await navigator.share(data);
      else await navigator.clipboard.writeText(url.toString());
      setStatus(tr("marketplaceLinkCopied"), "success");
      return true;
    } catch(error){
      if(error?.name === "AbortError") return false;
      setStatus(tr("marketplaceShareFailed"), "error");
      return false;
    }
  }

  function closeDetail({restoreFocus=true, clearHash=false}={}){
    const modal = byId("marketplaceDetailModal");
    if(!modal) return;
    state.detailRequest += 1;
    unloadRenderedMedia(byId("marketplaceDetailContent"));
    modal.hidden = true;
    byId("marketplaceDetailContent")?.replaceChildren();
    const closingListingId = listingId(state.detail);
    state.detail = null;
    if(clearHash && LISTING_HASH_RE.test(window.location.hash)) history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    const focus = state.returnFocus;
    state.returnFocus = null;
    const fallback = closingListingId
      ? document.querySelector(`[data-listing-id="${closingListingId}"] .marketplace-card-title`)
      : null;
    if(restoreFocus) (canRestoreFocus(focus) ? focus : fallback || document.querySelector("#marketplaceModes [aria-selected='true']") || byId("marketplaceSellButton"))?.focus();
  }

  function openModal(modal, focusTarget){
    if(!modal) return;
    modal.hidden = false;
    requestAnimationFrame(() => (focusTarget || modal.querySelector("button, input, textarea, select"))?.focus());
  }

  async function openListing(id, trigger=document.activeElement){
    id = String(id || "");
    if(!UUID_RE.test(id) || !authClient || !state.userId) return null;
    const context = currentContext();
    const requestedAsCrossCampus = state.scope === "global"
      || state.items.some(item => listingId(item) === id && isCrossCampusListing(item));
    const request = ++state.detailRequest;
    const detailModal = byId("marketplaceDetailModal");
    if(detailModal?.hidden){
      state.returnFocus = trigger instanceof HTMLElement ? trigger : null;
    }
    const content = byId("marketplaceDetailContent");
    content?.replaceChildren(element("div", "marketplace-detail-loading", tr(state.scope === "global" ? "marketplaceGlobalLoading" : "marketplaceLoading")));
    openModal(byId("marketplaceDetailModal"), byId("marketplaceDetailClose"));
    try {
      const {data, error} = await authClient.rpc("get_marketplace_listing", {p_listing_id:id});
      if(!contextIsCurrent(context) || request !== state.detailRequest) return null;
      if(error) throw error;
      const listing = listingRecord(data);
      if(!listing || !UUID_RE.test(listingId(listing))) throw new Error("Listing is unavailable");
      if(requestedAsCrossCampus || listing.is_cross_school === true) listing._crossCampus = true;
      state.detail = listing;
      renderListingDetail(listing);
      if(window.location.hash !== `#listing-${id}`) history.replaceState(null, "", `#listing-${id}`);
      return listing;
    } catch(error){
      if(contextIsCurrent(context) && request === state.detailRequest){
        content?.replaceChildren(element("div", "marketplace-empty", featureError(error)));
      }
      return null;
    }
  }

  function detailAction(label, className="marketplace-detail-action"){
    const button = element("button", className, label);
    button.type = "button";
    return button;
  }

  function renderOffers(listing){
    const offers = parseJson(listing.offers, []);
    if(!Array.isArray(offers) || (!offers.length && !isOwnListing(listing))) return null;
    const section = element("section", "marketplace-detail-section");
    section.append(element("h3", "", tr("marketplaceOffers")));
    section.append(element("p", "marketplace-muted", tr("marketplaceOfferDisclaimer")));
    if(!offers.length) section.append(element("p", "marketplace-muted", tr("marketplaceNoOffers")));
    offers.forEach(offer => {
      const row = element("div", "marketplace-offer-row");
      row.append(element("strong", "", tr("marketplaceOffer", {price:formatMoney(offer.amount_minor, listing.currency)})));
      if(isOwnListing(listing) && offer.buyer && typeof offer.buyer === "object"){
        const buyerName = String(offer.buyer.display_name || offer.buyer.username || tr("anonymousStudent"));
        row.append(element("span", "marketplace-offer-buyer", offer.buyer.username ? `${buyerName} · @${offer.buyer.username}` : buyerName));
        if(offer.buyer.username){
          const messageBuyer = element("button", "marketplace-card-action", tr("marketplaceMessageBuyer"));
          messageBuyer.type = "button";
          messageBuyer.addEventListener("click", () => void messageUsername(offer.buyer.username));
          row.append(messageBuyer);
        }
      }
      if(offer.message) row.append(element("span", "", String(offer.message)));
      if(offer.created_at) row.append(element("time", "", formatDate(offer.created_at)));
      section.append(row);
    });
    return section;
  }

  function renderListingDetail(listing){
    const content = byId("marketplaceDetailContent");
    if(!content) return;
    unloadRenderedMedia(content);
    content.replaceChildren();
    const id = listingId(listing);
    const crossCampus = isCrossCampusListing(listing);
    const layout = element("article", "marketplace-detail");
    const gallery = element("div", "marketplace-detail-gallery");
    const media = normalizeMedia(listing.media);
    if(media.length) media.forEach(item => gallery.append(privateMedia(item, {context:currentContext()})));
    else gallery.append(element("div", "marketplace-detail-no-media", tr("marketplaceNoMedia")));
    layout.append(gallery);

    const information = element("div", "marketplace-detail-information");
    const chips = element("div", "marketplace-detail-chips");
    chips.append(element("span", "marketplace-category-chip", labelFor("marketplaceCategory", listing.category)));
    chips.append(element("span", "marketplace-status-chip", listingStatusLabel(listing)));
    information.append(chips);
    information.append(element("h2", "marketplace-detail-title", String(listing.title || "")));
    const schoolContext = crossCampus ? universityContext(listing) : null;
    if(schoolContext) information.append(schoolContext);
    information.append(element("strong", "marketplace-detail-price", listingPrice(listing)));
    if(listing.negotiable) information.append(element("span", "marketplace-negotiable", tr("marketplaceNegotiable")));
    information.append(element("p", "marketplace-detail-description", String(listing.description || "")));

    const facts = element("dl", "marketplace-detail-facts");
    const addFact = (label, value) => {
      if(!value) return;
      facts.append(element("dt", "", label), element("dd", "", value));
    };
    addFact(tr("marketplaceCondition"), labelFor("marketplaceCondition", listing.condition));
    addFact(tr("marketplaceDelivery"), (parseJson(listing.delivery_methods, []) || []).map(value => labelFor("marketplaceDelivery", value)).join(" · "));
    addFact(tr("marketplaceCourse"), String(listing.course_code || listing.course || ""));
    addFact(tr("marketplacePosted", {date:formatDate(listing.created_at)}), listing.created_at ? formatDate(listing.created_at) : "");
    information.append(facts);

    const seller = normalizeSeller(listing);
    const sellerPanel = element("section", "marketplace-seller-panel");
    sellerPanel.append(element("span", "marketplace-section-label", tr("marketplaceSeller")), sellerButton(listing));
    if(seller.username && !crossCampus) sellerPanel.append(element("span", "marketplace-muted", `@${seller.username}`));
    information.append(sellerPanel);

    const warning = element("div", "marketplace-checkout-warning");
    warning.setAttribute("role", "note");
    warning.append(
      element("strong", "", tr(crossCampus ? "marketplaceGlobalScope" : "marketplaceCheckoutComingSoon")),
      element("p", "", tr(crossCampus ? "marketplaceGlobalDiscoveryBoundary" : "marketplaceCheckoutWarning"))
    );
    information.append(warning);

    const actions = element("div", "marketplace-detail-actions");
    if(isOwnListing(listing)){
      const sellerControlled = ["draft", "active", "paused"].includes(String(listing.status));
      if(sellerControlled){
        const edit = detailAction(tr("edit"));
        edit.addEventListener("click", () => void openListingEditor(listing, edit));
        actions.append(edit);
      }
      if(listing.status === "active"){
        const pause = detailAction(tr("marketplacePause"));
        pause.addEventListener("click", () => void updateListingStatus(id, "paused", pause));
        actions.append(pause);
        const soldLabel = getListingMode(listing) === "wanted"
          ? "marketplaceCloseRequest"
          : getListingMode(listing) === "free"
            ? "marketplaceMarkClaimed"
            : "marketplaceMarkSold";
        const soldConfirm = getListingMode(listing) === "wanted"
          ? "marketplaceCloseRequestConfirm"
          : getListingMode(listing) === "free"
            ? "marketplaceMarkClaimedConfirm"
            : "marketplaceMarkSoldConfirm";
        const sold = detailAction(tr(soldLabel));
        sold.addEventListener("click", async () => {
          const confirmed = await ask({title:tr(soldLabel), message:tr(soldConfirm), confirmLabel:tr(soldLabel)});
          if(confirmed) await updateListingStatus(id, "sold", sold);
        });
        actions.append(sold);
      } else if(["draft", "paused"].includes(listing.status)){
        const activateButton = detailAction(tr("marketplaceActivate"));
        activateButton.addEventListener("click", () => void updateListingStatus(id, "active", activateButton));
        actions.append(activateButton);
      }
      if(sellerControlled || listing.status === "sold"){
        const remove = detailAction(tr("marketplaceDelete"), "marketplace-detail-action danger");
        remove.addEventListener("click", async () => {
          const confirmed = await ask({title:tr("marketplaceDelete"), message:tr("marketplaceDeleteConfirm"), confirmLabel:tr("marketplaceDelete"), danger:true});
          if(confirmed) await updateListingStatus(id, "deleted", remove);
        });
        actions.append(remove);
      }
    } else {
      const favorite = detailAction(listing.favorited_by_me || listing.viewer?.favorited ? tr("marketplaceUnfavorite") : tr("marketplaceFavorite"));
      favorite.classList.toggle("active", listing.favorited_by_me || listing.viewer?.favorited);
      favorite.setAttribute("aria-pressed", listing.favorited_by_me || listing.viewer?.favorited ? "true" : "false");
      favorite.addEventListener("click", () => void toggleFavorite(id, favorite));
      actions.append(favorite);
      const message = detailAction(tr("marketplaceMessageSeller"));
      if(crossCampus){
        message.disabled = listing.can_message_seller !== true;
        if(message.disabled) message.title = tr("marketplaceGlobalMessageUnavailable");
        message.addEventListener("click", () => void startGlobalMarketplaceConversation(listing, message));
      } else {
        message.disabled = !seller.username;
        message.addEventListener("click", () => void messageSeller(listing));
      }
      actions.append(message);
      if(!crossCampus && String(listing.status || "active") === "active"){
        if(listing.status === "active" && getListingMode(listing) === "sale" && listing.negotiable === true){
          const offer = detailAction(tr("marketplaceMakeOffer"));
          offer.addEventListener("click", () => void makeOffer(listing, offer));
          actions.append(offer);
        }
        if(listing.status === "active" && getListingMode(listing) !== "wanted"){
          const order = detailAction(tr("marketplaceCheckoutComingSoon"), "marketplace-detail-action primary");
          order.disabled = true;
          order.setAttribute("aria-disabled", "true");
          order.title = tr("marketplaceCheckoutWarning");
          actions.append(order);
        }
      }
      const report = detailAction(tr("marketplaceReport"));
      report.addEventListener("click", () => void reportListing(id, report));
      actions.append(report);
    }
    const share = detailAction(tr("marketplaceShare"));
    share.addEventListener("click", () => void shareListing(id, listing.title));
    actions.append(share);
    information.append(actions);
    const offers = crossCampus ? null : renderOffers(listing);
    if(offers) information.append(offers);
    layout.append(information);
    content.append(layout);
  }

  async function ask(options){
    if(typeof hub().requestAction === "function") return hub().requestAction(options);
    if(options.input) return window.prompt(options.message || options.title, "");
    return window.confirm(options.message || options.title);
  }

  async function messageSeller(listing){
    const username = normalizeSeller(listing).username;
    if(!username) return;
    await messageUsername(username);
  }

  async function startGlobalMarketplaceConversation(listing, trigger){
    const id = listingId(listing);
    if(!UUID_RE.test(id) || listing.can_message_seller !== true || state.busyListings.has(id)) return;
    const context = currentContext();
    state.busyListings.add(id);
    if(trigger) trigger.disabled = true;
    try {
      const {data, error} = await authClient.rpc("start_marketplace_conversation", {p_listing_id:id});
      if(!contextIsCurrent(context)) return;
      if(error) throw error;
      const conversationId = String(Array.isArray(data) ? data[0]?.conversation_id || data[0] || "" : data || "");
      if(!UUID_RE.test(conversationId)) throw new Error("Conversation could not be started");
      setStatus(tr("marketplaceGlobalConversationStarted"), "success");
      closeDetail({restoreFocus:false, clearHash:true});
      if(typeof hub().openConversationById === "function"){
        const opened = await hub().openConversationById(conversationId);
        if(!opened) throw new Error("Conversation could not be opened");
      } else if(typeof hub().switchView === "function"){
        await hub().switchView("messages");
      }
    } catch(error){
      if(contextIsCurrent(context)) setStatus(featureError(error), "error");
    } finally {
      if(contextIsCurrent(context)){
        state.busyListings.delete(id);
        if(trigger?.isConnected) trigger.disabled = false;
      }
    }
  }

  async function messageUsername(username){
    if(!username || typeof hub().switchView !== "function") return;
    const context = currentContext();
    if(!byId("marketplaceDetailModal")?.hidden) closeDetail({restoreFocus:false, clearHash:true});
    await hub().switchView("messages");
    if(!contextIsCurrent(context)) return;
    const usernameInput = byId("chatUsername");
    if(usernameInput) usernameInput.value = username;
    byId("startConversation")?.click();
  }

  async function makeOffer(listing, trigger){
    const id = listingId(listing);
    if(state.busyListings.has(id)) return;
    const context = currentContext();
    const currency = String(listing.currency || "HKD").toUpperCase();
    const rawAmount = await ask({title:tr("marketplaceMakeOffer"), message:`${tr("marketplaceOfferAmount")}\n\n${tr("marketplaceOfferDisclaimer")}`, input:true, inputMode:["JPY", "KRW"].includes(currency) ? "numeric" : "decimal", maxLength:16, placeholder:["JPY", "KRW"].includes(currency) ? "0" : "0.00", requiredMessage:tr("marketplacePollInvalid"), confirmLabel:tr("marketplaceMakeOffer")});
    if(rawAmount === null || rawAmount === false || !contextIsCurrent(context)) return;
    const amountText = String(rawAmount).trim();
    const validAmount = ["JPY", "KRW"].includes(currency)
      ? /^(?:0|[1-9]\d{0,11})$/.test(amountText)
      : /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(amountText);
    const amount = validAmount ? Number(amountText) : Number.NaN;
    if(!Number.isFinite(amount) || amount <= 0){ setStatus(tr("marketplacePollInvalid"), "error"); return; }
    const rawMessage = await ask({title:tr("marketplaceMakeOffer"), message:tr("marketplaceOfferMessage"), input:true, inputRequired:false, maxLength:500, placeholder:"", confirmLabel:tr("marketplaceMakeOffer")});
    if(rawMessage === null || rawMessage === false || !contextIsCurrent(context)) return;
    const multiplier = currency === "JPY" || currency === "KRW" ? 1 : 100;
    state.busyListings.add(id);
    if(trigger) trigger.disabled = true;
    try {
      const {error} = await authClient.rpc("make_marketplace_offer", {
        p_listing_id:id,
        p_amount_minor:Math.round(amount * multiplier),
        p_message:String(rawMessage || "").trim() || null
      });
      if(!contextIsCurrent(context)) return;
      if(error) throw error;
      setStatus(tr("marketplaceOfferSent"), "success");
      await openListing(id, trigger);
    } catch(error){ if(contextIsCurrent(context)) setStatus(featureError(error) || tr("marketplaceOfferFailed"), "error"); }
    finally { if(contextIsCurrent(context)){ state.busyListings.delete(id); if(trigger?.isConnected) trigger.disabled = false; } }
  }

  async function reportListing(id, trigger){
    const context = currentContext();
    const reason = await ask({title:tr("marketplaceReport"), message:tr("marketplaceReportReason"), input:true, maxLength:500, confirmLabel:tr("report"), danger:true});
    if(!reason || !String(reason).trim() || !contextIsCurrent(context)) return;
    if(trigger) trigger.disabled = true;
    try {
      const {error} = await authClient.rpc("report_marketplace_listing", {p_listing_id:id, p_reason:String(reason).trim().slice(0, 500)});
      if(!contextIsCurrent(context)) return;
      if(error) throw error;
      setStatus(tr("marketplaceReported"), "success");
    } catch(error){ if(contextIsCurrent(context)) setStatus(featureError(error), "error"); }
    finally { if(contextIsCurrent(context) && trigger?.isConnected) trigger.disabled = false; }
  }

  async function updateListingStatus(id, status, trigger){
    if(!UUID_RE.test(id) || !["active", "paused", "sold", "deleted"].includes(status) || state.busyListings.has(id)) return;
    const context = currentContext();
    state.busyListings.add(id);
    if(trigger) trigger.disabled = true;
    try {
      const {error} = await authClient.rpc("set_marketplace_listing_status", {p_listing_id:id, p_status:status});
      if(!contextIsCurrent(context)) return;
      if(error) throw error;
      setStatus(tr("marketplaceStatusUpdated"), "success");
      if(status === "deleted") closeDetail({restoreFocus:false, clearHash:true});
      else await openListing(id, trigger);
      await loadMarketplace({force:true});
      await loadCommunityListingChoices();
    } catch(error){ if(contextIsCurrent(context)) setStatus(featureError(error), "error"); }
    finally { if(contextIsCurrent(context)){ state.busyListings.delete(id); if(trigger?.isConnected) trigger.disabled = false; } }
  }

  function revokeEditorPreviews(){
    state.editorMedia.forEach(item => { if(item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
    state.editorMedia = [];
    unloadRenderedMedia(byId("marketplaceMediaPreview"));
  }

  function setEditorStatus(message="", kind=""){
    const target = byId("marketplaceEditorStatus");
    if(!target) return;
    target.textContent = message;
    target.className = `hub-inline-status marketplace-editor-status${kind ? ` ${kind}` : ""}`;
  }

  function setEditorBusy(busy){
    state.editorBusy = busy;
    byId("marketplaceListingEditorForm")?.querySelectorAll("input, textarea, select, button").forEach(control => { control.disabled = busy; });
    if(state.editorListing){
      if(byId("marketplaceMediaInput")) byId("marketplaceMediaInput").disabled = true;
      if(byId("marketplaceAddMediaButton")) byId("marketplaceAddMediaButton").disabled = true;
    }
    if(!busy) syncListingModeFields();
  }

  function syncListingModeFields(){
    const mode = byId("marketplaceTypeInput")?.value;
    const price = byId("marketplacePriceInput");
    const negotiable = byId("marketplaceNegotiableInput");
    if(price){
      if(mode === "free") price.value = "0";
      price.disabled = state.editorBusy || mode === "free";
    }
    if(negotiable){
      if(mode !== "sale") negotiable.checked = false;
      negotiable.disabled = state.editorBusy || mode !== "sale";
    }
  }

  function renderEditorMedia(){
    const preview = byId("marketplaceMediaPreview");
    if(!preview) return;
    unloadRenderedMedia(preview);
    preview.replaceChildren();
    state.editorMedia.forEach((item, index) => {
      const card = element("article", "marketplace-editor-media-item");
      if(item.existing) card.append(privateMedia(item.descriptor, {compact:true, context:currentContext(), controls:false}));
      else if(item.kind === "video"){
        const video = element("video");
        video.src = item.previewUrl;
        video.muted = true;
        video.controls = true;
        video.preload = "metadata";
        card.append(video);
      } else {
        const image = element("img");
        image.src = item.previewUrl;
        image.alt = item.altText || "";
        card.append(image);
      }
      if(!item.existing){
        const remove = element("button", "marketplace-editor-media-remove", "×");
        remove.type = "button";
        remove.setAttribute("aria-label", `${tr("marketplaceRemoveMedia")} ${index + 1}`);
        remove.addEventListener("click", () => {
          if(item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          state.editorMedia = state.editorMedia.filter(candidate => candidate.id !== item.id);
          renderEditorMedia();
          const remaining = [...byId("marketplaceMediaPreview").querySelectorAll(".marketplace-editor-media-remove")];
          const focusTarget = remaining[Math.min(index, remaining.length - 1)] || byId("marketplaceAddMediaButton");
          requestAnimationFrame(() => focusTarget?.focus());
        });
        card.append(remove);
        const alt = element("input", "marketplace-editor-media-alt");
        alt.type = "text";
        alt.maxLength = 180;
        alt.value = item.altText || "";
        alt.placeholder = tr("marketplaceMediaDescription", {number:index + 1});
        alt.setAttribute("aria-label", tr("marketplaceMediaDescription", {number:index + 1}));
        alt.addEventListener("input", () => { item.altText = alt.value; });
        card.append(alt);
      }
      preview.append(card);
    });
  }

  async function prepareEditorMedia(files){
    if(state.editorBusy || state.editorListing) return;
    const candidates = [...(files || [])];
    if(!candidates.length) return;
    const available = MAX_MEDIA - state.editorMedia.length;
    if(available <= 0){ setEditorStatus(tr("marketplaceMediaLimit"), "error"); return; }
    const context = currentContext();
    const operation = ++state.editorOperation;
    setEditorBusy(true);
    setEditorStatus(tr("marketplacePreparingMedia"));
    const prepared = [];
    let rejectedCount = 0;
    let lastError = "";
    let committed = false;
    try {
      for(const file of candidates.slice(0, available)){
        if(!contextIsCurrent(context) || operation !== state.editorOperation) return;
        try {
          const tools = hub().mediaTools || {};
          const type = typeof tools.videoUploadType === "function" ? tools.videoUploadType(file) : null;
          if(type){
            if(file.size > 50 * 1024 * 1024) throw new Error(tr("marketplaceVideoTooLarge"));
            if(typeof tools.validateVideoSignature !== "function") throw new Error(tr("marketplaceMediaInvalid"));
            await tools.validateVideoSignature(file, type);
            prepared.push({id:crypto.randomUUID(), kind:"video", blob:file, mimeType:type.mimeType, extension:type.extension, previewUrl:URL.createObjectURL(file), altText:""});
          } else {
            const normalizeImage = tools.normalizeRasterUpload || tools.normalizeRasterToWebP;
            if(typeof normalizeImage !== "function") throw new Error(tr("marketplaceMediaInvalid"));
            const normalized = await normalizeImage(file, {
              maxEdge:2400,
              maxInputBytes:25 * 1024 * 1024,
              maxOutputBytes:8 * 1024 * 1024,
              quality:.87,
              invalidMessage:tr("marketplaceMediaInvalid"),
              tooLargeMessage:tr("marketplaceImageTooLarge"),
              svgMessage:tr("svgUnsupported")
            });
            prepared.push({id:crypto.randomUUID(), kind:"image", blob:normalized.blob, mimeType:normalized.mimeType, extension:normalized.extension, previewUrl:URL.createObjectURL(normalized.blob), altText:"", width:normalized.width, height:normalized.height});
          }
        } catch(error){
          rejectedCount += 1;
          lastError = error?.message || tr("marketplaceMediaInvalid");
        }
      }
      if(!contextIsCurrent(context) || operation !== state.editorOperation) return;
      state.editorMedia.push(...prepared);
      committed = true;
      renderEditorMedia();
      if(candidates.length > available) setEditorStatus(tr("marketplaceMediaLimit"), "error");
      else if(rejectedCount) setEditorStatus(prepared.length ? tr("marketplaceMediaPartiallyReady", {count:rejectedCount}) : lastError, "error");
      else setEditorStatus(tr("marketplaceMediaReady"), "success");
    } catch(error){
      if(contextIsCurrent(context) && operation === state.editorOperation) setEditorStatus(error?.message || tr("marketplaceMediaInvalid"), "error");
    } finally {
      if(!committed) prepared.forEach(item => URL.revokeObjectURL(item.previewUrl));
      if(contextIsCurrent(context) && operation === state.editorOperation){
        setEditorBusy(false);
        if(byId("marketplaceMediaInput")) byId("marketplaceMediaInput").value = "";
      }
    }
  }

  function fillEditor(listing){
    byId("marketplaceTitleInput").value = listing?.title || "";
    byId("marketplaceDescriptionInput").value = listing?.description || "";
    byId("marketplaceCategoryInput").value = CATEGORY_VALUES.includes(listing?.category) ? listing.category : "notes";
    byId("marketplaceTypeInput").value = MODE_VALUES.includes(getListingMode(listing)) ? getListingMode(listing) : "sale";
    byId("marketplaceConditionInput").value = CONDITION_VALUES.includes(listing?.condition) ? listing.condition : "good";
    const currency = String(listing?.currency || "HKD").toUpperCase();
    byId("marketplaceCurrencyInput").value = CURRENCY_VALUES.includes(currency) ? currency : "HKD";
    byId("marketplacePriceInput").value = listing ? String(getListingPrice(listing) / (["JPY", "KRW"].includes(currency) ? 1 : 100)) : "";
    byId("marketplaceCourseInput").value = listing?.course_code || listing?.course || "";
    byId("marketplaceNegotiableInput").checked = listing?.negotiable === true;
    byId("marketplaceRightsInput").checked = !!listing?.rights_attestation || listing?.academic_rights_confirmed === true;
    if(byId("marketplaceGlobalVisibilityInput")) byId("marketplaceGlobalVisibilityInput").checked = listing?.global_visible === true;
    if(byId("marketplaceRightsBasisInput")) byId("marketplaceRightsBasisInput").value = RIGHTS_BASIS_VALUES.includes(listing?.academic_rights_basis) ? listing.academic_rights_basis : "not_applicable";
    const deliveries = new Set(parseJson(listing?.delivery_methods, []));
    document.querySelectorAll('#marketplaceDeliveryInputs input[name="marketplaceDelivery"]').forEach(input => { input.checked = deliveries.has(input.value); });
    syncRightsBasisField({preserve:true});
    syncListingModeFields();
  }

  function syncRightsBasisField({preserve=false}={}){
    const category = byId("marketplaceCategoryInput")?.value;
    const academic = ["notes", "past_papers"].includes(category);
    const pastPaper = category === "past_papers";
    const field = byId("marketplaceRightsBasisField");
    const input = byId("marketplaceRightsBasisInput");
    if(field) field.hidden = !academic;
    if(!input) return;
    input.required = academic;
    const original = input.querySelector('option[value="original"]');
    const notApplicable = input.querySelector('option[value="not_applicable"]');
    if(original) original.disabled = pastPaper;
    if(notApplicable) notApplicable.disabled = academic;
    if(!academic){ input.value = "not_applicable"; return; }
    if(pastPaper && !["licensed", "public_domain"].includes(input.value)) input.value = "";
    else if(!pastPaper && !["original", "licensed", "public_domain"].includes(input.value) && !preserve) input.value = "original";
  }

  async function openListingEditor(listing=null, trigger=document.activeElement){
    if(!state.userId || (state.scope === "global" && !listing)) return;
    let fullListing = listing;
    if(listing && !listing.description){
      const id = listingId(listing);
      const context = currentContext();
      const {data, error} = await authClient.rpc("get_marketplace_listing", {p_listing_id:id});
      if(!contextIsCurrent(context) || error) return;
      fullListing = listingRecord(data);
    }
    if(!byId("marketplaceDetailModal")?.hidden) closeDetail({restoreFocus:false, clearHash:true});
    revokeEditorPreviews();
    state.editorListing = fullListing;
    state.editorReturnFocus = trigger instanceof HTMLElement && trigger.isConnected ? trigger : byId("marketplaceSellButton");
    byId("marketplaceListingEditorTitle").textContent = tr(fullListing ? "marketplaceEditListing" : "marketplaceNewListing");
    byId("marketplaceListingEditorForm")?.reset();
    fillEditor(fullListing || {});
    state.editorMedia = normalizeMedia(fullListing?.media).map(descriptor => ({id:String(descriptor.id || crypto.randomUUID()), existing:true, descriptor}));
    renderEditorMedia();
    setEditorStatus(fullListing ? tr("marketplaceEditMediaLocked") : tr("marketplaceRightsStudy"));
    if(byId("marketplaceMediaInput")) byId("marketplaceMediaInput").disabled = !!fullListing;
    if(byId("marketplaceAddMediaButton")) byId("marketplaceAddMediaButton").disabled = !!fullListing;
    openModal(byId("marketplaceListingEditorModal"), byId("marketplaceTitleInput"));
  }

  function closeEditor({restoreFocus=true, force=false}={}){
    if(state.editorBusy && !force) return;
    if(force) setEditorBusy(false);
    state.editorOperation += 1;
    byId("marketplaceListingEditorModal").hidden = true;
    revokeEditorPreviews();
    state.editorListing = null;
    byId("marketplaceListingEditorForm")?.reset();
    setEditorStatus("");
    const focus = state.editorReturnFocus;
    state.editorReturnFocus = null;
    if(restoreFocus) (canRestoreFocus(focus) ? focus : byId("marketplaceSellButton"))?.focus();
  }

  function editorPayload(){
    const title = byId("marketplaceTitleInput").value.trim();
    const description = byId("marketplaceDescriptionInput").value.trim();
    const category = byId("marketplaceCategoryInput").value;
    const mode = byId("marketplaceTypeInput").value;
    const condition = byId("marketplaceConditionInput").value;
    const currency = byId("marketplaceCurrencyInput").value.toUpperCase();
    const amount = Number(byId("marketplacePriceInput").value);
    const deliveries = [...document.querySelectorAll('#marketplaceDeliveryInputs input[name="marketplaceDelivery"]:checked')].map(input => input.value).filter(value => DELIVERY_VALUES.includes(value));
    if(!title){ byId("marketplaceTitleInput").setCustomValidity(tr("marketplaceTitleRequired")); byId("marketplaceTitleInput").reportValidity(); byId("marketplaceTitleInput").setCustomValidity(""); return null; }
    if(!description){ byId("marketplaceDescriptionInput").setCustomValidity(tr("marketplaceDescriptionRequired")); byId("marketplaceDescriptionInput").reportValidity(); byId("marketplaceDescriptionInput").setCustomValidity(""); return null; }
    if(!CATEGORY_VALUES.includes(category) || !MODE_VALUES.includes(mode) || !CONDITION_VALUES.includes(condition) || !CURRENCY_VALUES.includes(currency)) return null;
    if((mode === "sale" && (!Number.isFinite(amount) || amount <= 0)) || (mode === "wanted" && (!Number.isFinite(amount) || amount < 0))){ byId("marketplacePriceInput").setCustomValidity(tr("marketplacePriceRequired")); byId("marketplacePriceInput").reportValidity(); byId("marketplacePriceInput").setCustomValidity(""); return null; }
    if(!deliveries.length){ setEditorStatus(tr("marketplaceDeliveryRequired"), "error"); return null; }
    if(!byId("marketplaceRightsInput").checked){ byId("marketplaceRightsInput").setCustomValidity(tr("marketplaceRightsRequired")); byId("marketplaceRightsInput").reportValidity(); byId("marketplaceRightsInput").setCustomValidity(""); return null; }
    const academic = ["notes", "past_papers"].includes(category);
    const basisInput = byId("marketplaceRightsBasisInput");
    const basis = academic ? String(basisInput?.value || "") : "not_applicable";
    if(academic && !["original", "licensed", "public_domain"].includes(basis)){
      setEditorStatus(tr("marketplaceRightsBasisRequired"), "error");
      basisInput?.focus();
      return null;
    }
    if(category === "past_papers" && !["licensed", "public_domain"].includes(basis)){
      setEditorStatus(tr("marketplacePastPaperRightsRequired"), "error");
      basisInput?.focus();
      return null;
    }
    const multiplier = ["JPY", "KRW"].includes(currency) ? 1 : 100;
    return {
      title:title.slice(0, 120),
      description:description.slice(0, 5000),
      category,
      mode,
      condition,
      price_minor:mode === "free" ? 0 : Math.round(amount * multiplier),
      currency,
      delivery_methods:deliveries,
      location_label:null,
      course_code:byId("marketplaceCourseInput").value.trim().slice(0, 80) || null,
      negotiable:byId("marketplaceNegotiableInput").checked,
      status:state.editorListing?.status || "active",
      rights_attestation:RIGHTS_ATTESTATION,
      academic_rights_basis:basis,
      academic_rights_confirmed:academic
    };
  }

  async function removeUploaded(paths){
    if(!paths.length || !authClient) return;
    try {
      const {error} = await authClient.storage.from(MARKETPLACE_BUCKET).remove(paths);
      if(error) console.warn("Marketplace media cleanup was deferred.", error);
    } catch(error){
      console.warn("Marketplace media cleanup was deferred.", error);
    }
  }

  async function uploadEditorMedia(listingUuid, context, operation){
    const paths = [];
    const descriptors = [];
    for(const [position, item] of state.editorMedia.filter(candidate => !candidate.existing).entries()){
      if(!contextIsCurrent(context) || operation !== state.editorOperation) throw new Error("Stale marketplace editor");
      const mediaUuid = item.id && UUID_RE.test(item.id) ? item.id : crypto.randomUUID();
      const path = `${context.userId}/listings/${listingUuid}/${mediaUuid}.${item.extension}`;
      let error;
      try {
        ({error} = await authClient.storage.from(MARKETPLACE_BUCKET).upload(path, item.blob, {upsert:false, contentType:item.mimeType, cacheControl:"31536000"}));
      } catch(uploadError){
        await removeUploaded([...paths, path]);
        const wrap = hub().mediaTools?.wrapMediaUploadError;
        throw typeof wrap === "function" ? wrap(uploadError, MARKETPLACE_BUCKET) : uploadError;
      }
      if(error){
        await removeUploaded(paths);
        const wrap = hub().mediaTools?.wrapMediaUploadError;
        throw typeof wrap === "function" ? wrap(error, MARKETPLACE_BUCKET) : error;
      }
      paths.push(path);
      descriptors.push({
        id:mediaUuid,
        storage_path:path,
        media_type:item.kind,
        mime_type:item.mimeType,
        width:item.width || null,
        height:item.height || null,
        duration_seconds:null,
        alt_text:String(item.altText || "").trim() || null,
        position
      });
    }
    return {paths, descriptors};
  }

  async function submitEditor(event){
    event?.preventDefault();
    if(state.editorBusy || !state.userId) return;
    const payload = editorPayload();
    if(!payload) return;
    const context = currentContext();
    const operation = ++state.editorOperation;
    const existing = state.editorListing;
    const shareGlobally = byId("marketplaceGlobalVisibilityInput")?.checked === true;
    const wasSharedGlobally = existing?.global_visible === true;
    const id = existing ? listingId(existing) : crypto.randomUUID();
    if(!UUID_RE.test(id)) return;
    let uploaded = [];
    setEditorBusy(true);
    setEditorStatus(tr("marketplaceSaving"));
    try {
      if(existing && wasSharedGlobally && !shareGlobally){
        const visibilityResponse = await authClient.rpc("set_marketplace_listing_global_visibility", {
          p_listing_id:id,
          p_visible:false
        });
        if(!contextIsCurrent(context) || operation !== state.editorOperation) return;
        if(visibilityResponse.error) throw visibilityResponse.error;
      }
      let response;
      if(existing){
        response = await authClient.rpc("update_marketplace_listing", {
          p_listing_id:id,
          p_expected_version:Number(existing.version || 1),
          p_payload:payload
        });
      } else {
        const mediaResult = await uploadEditorMedia(id, context, operation);
        uploaded = mediaResult.paths;
        response = await authClient.rpc("create_marketplace_listing", {p_listing_id:id, p_payload:payload, p_media:mediaResult.descriptors});
      }
      if(!contextIsCurrent(context) || operation !== state.editorOperation){ await removeUploaded(uploaded); return; }
      if(response.error) throw response.error;
      let globalVisibilityFailed = false;
      if(shareGlobally && (!existing || !wasSharedGlobally)){
        const visibilityResponse = await authClient.rpc("set_marketplace_listing_global_visibility", {
          p_listing_id:id,
          p_visible:true
        });
        if(!contextIsCurrent(context) || operation !== state.editorOperation){ await removeUploaded(uploaded); return; }
        globalVisibilityFailed = !!visibilityResponse.error;
      }
      uploaded = [];
      closeEditor({restoreFocus:false, force:true});
      await Promise.all([loadMarketplace({force:true}), loadCommunityListingChoices()]);
      setStatus(
        globalVisibilityFailed
          ? tr("marketplaceGlobalVisibilityFailed")
          : tr(shareGlobally ? "marketplaceSavedGlobally" : "marketplaceSavedCampusOnly"),
        globalVisibilityFailed ? "error" : "success"
      );
      if(globalVisibilityFailed) return;
      await openListing(id, byId("marketplaceSellButton"));
    } catch(error){
      await removeUploaded(uploaded);
      if(contextIsCurrent(context) && operation === state.editorOperation){
        const mapUploadError = hub().mediaTools?.mediaUploadError;
        const message = error?.mediaUpload && typeof mapUploadError === "function"
          ? mapUploadError(error, {membershipRequired:true})
          : featureError(error) || tr("marketplaceSaveFailed");
        setEditorStatus(message, "error");
      }
    } finally {
      if(contextIsCurrent(context) && operation === state.editorOperation && !byId("marketplaceListingEditorModal").hidden) setEditorBusy(false);
    }
  }

  function orderStatusLabel(status){ return tr(`marketplace${String(status || "").split("_").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join("")}`); }

  function orderListing(order){
    if(order?.listing && typeof order.listing === "object") return order.listing;
    const snapshot = parseJson(order?.listing_snapshot, null);
    return snapshot && typeof snapshot === "object" ? snapshot : {};
  }

  function orderCard(order){
    const id = orderId(order);
    const listing = orderListing(order);
    const card = element("article", "marketplace-order-card");
    const media = normalizeMedia(listing.media);
    if(media[0]) card.append(privateMedia(media[0], {compact:true, context:currentContext(), controls:false}));
    const top = element("div", "marketplace-order-card-top");
    top.append(element("span", "marketplace-order-role", order.role === "seller" || order.seller_id === state.userId ? tr("marketplaceOrderRoleSeller") : tr("marketplaceOrderRoleBuyer")));
    top.append(element("span", `marketplace-status-chip status-${String(order.status || "")}`, orderStatusLabel(order.status)));
    card.append(top, element("h3", "", String(listing.title || order.listing_title || tr("marketplaceOrder"))), element("strong", "marketplace-card-price", formatMoney(order.amount_minor ?? listing.price_minor, order.currency ?? listing.currency)));
    card.append(element("p", "marketplace-checkout-mini", tr("marketplaceCheckoutWarning")));
    const open = element("button", "marketplace-card-action", tr("marketplaceViewOrder"));
    open.type = "button";
    open.addEventListener("click", () => void openOrder(id, open));
    card.append(open);
    return card;
  }

  function closeOrder({restoreFocus=true}={}){
    state.orderRequest += 1;
    byId("marketplaceOrderModal").hidden = true;
    unloadRenderedMedia(byId("marketplaceOrderContent"));
    byId("marketplaceOrderContent")?.replaceChildren();
    state.order = null;
    const focus = state.orderReturnFocus;
    state.orderReturnFocus = null;
    if(restoreFocus) (canRestoreFocus(focus) ? focus : document.querySelector('[data-market-mode="orders"]') || document.querySelector("#marketplaceModes [aria-selected='true']"))?.focus();
  }

  async function openOrder(id, trigger=document.activeElement){
    if(!UUID_RE.test(String(id)) || !state.userId) return;
    if(!byId("marketplaceDetailModal")?.hidden) closeDetail({restoreFocus:false, clearHash:true});
    const context = currentContext();
    const request = ++state.orderRequest;
    const orderModal = byId("marketplaceOrderModal");
    if(orderModal?.hidden){
      state.orderReturnFocus = trigger instanceof HTMLElement && trigger.isConnected ? trigger : document.querySelector('[data-market-mode="orders"]');
    }
    byId("marketplaceOrderContent")?.replaceChildren(element("div", "marketplace-detail-loading", tr("marketplaceLoading")));
    openModal(byId("marketplaceOrderModal"), byId("marketplaceOrderClose"));
    try {
      const {data, error} = await authClient.rpc("get_marketplace_order", {p_order_id:id});
      if(!contextIsCurrent(context) || request !== state.orderRequest) return;
      if(error) throw error;
      const order = orderRecord(data);
      if(!order) throw new Error("Order unavailable");
      state.order = order;
      renderOrder(order);
    } catch(error){ if(contextIsCurrent(context) && request === state.orderRequest) byId("marketplaceOrderContent")?.replaceChildren(element("div", "marketplace-empty", featureError(error) || tr("marketplaceOrderUnavailable"))); }
  }

  function renderOrder(order){
    const content = byId("marketplaceOrderContent");
    if(!content) return;
    unloadRenderedMedia(content);
    content.replaceChildren();
    const listing = orderListing(order);
    const article = element("article", "marketplace-order-detail");
    const media = normalizeMedia(listing.media);
    if(media.length){
      const gallery = element("div", "marketplace-detail-gallery");
      media.slice(0, 4).forEach(item => gallery.append(privateMedia(item, {context:currentContext()})));
      article.append(gallery);
    }
    article.append(element("span", "marketplace-section-label", tr("marketplaceOrder")), element("h2", "", String(listing.title || order.listing_title || tr("marketplaceOrder"))), element("strong", "marketplace-detail-price", formatMoney(order.amount_minor ?? listing.price_minor, order.currency ?? listing.currency)));
    const warning = element("div", "marketplace-checkout-warning");
    warning.setAttribute("role", "alert");
    warning.append(element("strong", "", tr("marketplaceAwaitingPayment")), element("p", "", tr("marketplaceCheckoutWarning")));
    article.append(warning);
    const timeline = element("ol", "marketplace-order-timeline");
    const currentIndex = ORDER_STEPS.indexOf(order.status);
    ORDER_STEPS.forEach((status, index) => {
      const item = element("li", index <= currentIndex ? "complete" : "");
      item.append(element("strong", "", orderStatusLabel(status)));
      timeline.append(item);
    });
    if(["disputed", "cancelled", "refunded"].includes(order.status)) timeline.append(element("li", "alert", orderStatusLabel(order.status)));
    article.append(timeline);
    if(order.fulfilled_note){
      const fulfilment = element("section", "marketplace-detail-section");
      fulfilment.append(element("h3", "", tr("marketplaceFulfilmentNote")), element("p", "", String(order.fulfilled_note)));
      article.append(fulfilment);
    }
    const events = parseJson(order.events, []);
    if(Array.isArray(events) && events.length){
      const history = element("div", "marketplace-order-history");
      events.forEach(event => {
        const row = element("div", "marketplace-order-event");
        row.append(element("strong", "", orderStatusLabel(event.event_type || event.status)), element("time", "", formatDate(event.created_at)));
        const metadata = parseJson(event.metadata, {});
        const note = event.note || (metadata && typeof metadata === "object" ? metadata.note || metadata.reason : "");
        if(note) row.append(element("p", "", String(note)));
        history.append(row);
      });
      article.append(history);
    }
    if(order.dispute && typeof order.dispute === "object"){
      const dispute = element("section", "marketplace-detail-section marketplace-order-dispute");
      dispute.append(element("h3", "", tr("marketplaceDisputeRecord")));
      if(order.dispute.reason) dispute.append(element("strong", "", String(order.dispute.reason)));
      if(order.dispute.details) dispute.append(element("p", "", String(order.dispute.details)));
      if(order.dispute.status) dispute.append(element("span", "marketplace-status-chip", labelFor("marketplaceStatus", order.dispute.status)));
      article.append(dispute);
    }
    if(order.review && typeof order.review === "object"){
      const review = element("section", "marketplace-detail-section marketplace-order-review");
      review.append(element("h3", "", tr("marketplaceReview")));
      if(Number(order.review.rating)) review.append(element("strong", "", tr("marketplaceRating", {rating:Number(order.review.rating)})));
      if(order.review.body) review.append(element("p", "", String(order.review.body)));
      article.append(review);
    }
    const actions = element("div", "marketplace-detail-actions");
    const sellerRole = order.role === "seller" || order.seller_id === state.userId;
    const buyerRole = order.role === "buyer" || order.buyer_id === state.userId;
    const paymentState = String(order.payment?.payment_state || "");
    if(sellerRole && order.status === "payment_held" && paymentState === "held"){
      const fulfill = detailAction(tr("marketplaceMarkFulfilled"), "marketplace-detail-action primary");
      fulfill.addEventListener("click", () => void markOrderFulfilled(order, fulfill));
      actions.append(fulfill);
    }
    if(buyerRole && order.status === "fulfilled" && paymentState === "held"){
      const accept = detailAction(tr("marketplaceAcceptOrder"), "marketplace-detail-action primary");
      accept.addEventListener("click", () => void acceptOrder(order, accept));
      actions.append(accept);
    }
    const paymentDisputeOpen = ["held", "release_pending"].includes(paymentState);
    if((buyerRole || sellerRole) && paymentDisputeOpen && ["payment_held", "fulfilled"].includes(order.status)){
      const dispute = detailAction(tr("marketplaceOpenDispute"), "marketplace-detail-action danger");
      dispute.addEventListener("click", () => void disputeOrder(order, dispute));
      actions.append(dispute);
    }
    article.append(actions);
    content.append(article);
  }

  async function orderMutation(order, trigger, rpc, params, successKey){
    const id = orderId(order);
    if(!UUID_RE.test(id) || state.busyOrders.has(id)) return;
    const context = currentContext();
    state.busyOrders.add(id);
    if(trigger) trigger.disabled = true;
    try {
      const {error} = await authClient.rpc(rpc, params);
      if(!contextIsCurrent(context)) return;
      if(error) throw error;
      setStatus(tr(successKey), "success");
      await Promise.all([openOrder(id, trigger), state.mode === "orders" ? loadMarketplace({force:true}) : Promise.resolve()]);
    } catch(error){ if(contextIsCurrent(context)) setStatus(featureError(error), "error"); }
    finally { if(contextIsCurrent(context)){ state.busyOrders.delete(id); if(trigger?.isConnected) trigger.disabled = false; } }
  }

  async function markOrderFulfilled(order, trigger){
    const note = await ask({title:tr("marketplaceMarkFulfilled"), message:tr("marketplaceFulfilmentNote"), input:true, inputRequired:false, maxLength:1000, placeholder:"", confirmLabel:tr("marketplaceMarkFulfilled")});
    if(note === null || note === false) return;
    await orderMutation(order, trigger, "mark_marketplace_order_fulfilled", {p_order_id:orderId(order), p_note:String(note || "").trim() || null}, "marketplaceFulfilledSaved");
  }

  async function acceptOrder(order, trigger){
    const ratingRaw = await ask({title:tr("marketplaceAcceptOrder"), message:tr("marketplaceRatingPrompt"), input:true, inputMode:"numeric", maxLength:1, placeholder:"1–5", requiredMessage:tr("marketplacePollInvalid"), confirmLabel:tr("marketplaceAcceptOrder")});
    if(ratingRaw === null || ratingRaw === false) return;
    const rating = Number(ratingRaw);
    if(!Number.isInteger(rating) || rating < 1 || rating > 5){ setStatus(tr("marketplacePollInvalid"), "error"); return; }
    const review = await ask({title:tr("marketplaceAcceptOrder"), message:tr("marketplaceReviewPrompt"), input:true, inputRequired:false, maxLength:1500, placeholder:"", confirmLabel:tr("marketplaceAcceptOrder")});
    if(review === null || review === false) return;
    await orderMutation(order, trigger, "accept_marketplace_order", {p_order_id:orderId(order), p_rating:rating, p_review:String(review || "").trim() || null}, "marketplaceAcceptedSaved");
  }

  async function disputeOrder(order, trigger){
    const reason = await ask({title:tr("marketplaceOpenDispute"), message:tr("marketplaceDisputeReason"), input:true, maxLength:80, confirmLabel:tr("marketplaceOpenDispute"), danger:true});
    if(!reason) return;
    const details = await ask({title:tr("marketplaceOpenDispute"), message:tr("marketplaceDisputeDetails"), input:true, maxLength:2000, confirmLabel:tr("marketplaceOpenDispute"), danger:true});
    if(!details) return;
    await orderMutation(order, trigger, "open_marketplace_dispute", {p_order_id:orderId(order), p_reason:String(reason).trim().slice(0, 80), p_details:String(details).trim().slice(0, 2000)}, "marketplaceDisputeOpened");
  }

  async function loadCommunityListingChoices(){
    const select = byId("communityListingSelect");
    if(!select || !authClient || !state.userId) return;
    const context = currentContext();
    const request = ++state.pickerRequest;
    try {
      const {data, error} = await authClient.rpc("get_my_marketplace_listings");
      if(!contextIsCurrent(context) || request !== state.pickerRequest) return;
      if(error) throw error;
      state.ownListings = collection(data).items;
      select.disabled = false;
      const active = state.ownListings.filter(item => item.status === "active" && UUID_RE.test(listingId(item)));
      const selectedId = state.selectedCommunityListing ? listingId(state.selectedCommunityListing) : "";
      select.replaceChildren();
      const empty = element("option", "", tr("marketplaceSelectListing"));
      empty.value = "";
      select.append(empty);
      active.forEach(listing => {
        const option = element("option", "", `${String(listing.title || "")} · ${listingPrice(listing)}`);
        option.value = listingId(listing);
        select.append(option);
      });
      select.value = active.some(item => listingId(item) === selectedId) ? selectedId : "";
      if(selectedId && !select.value) clearCommunityListing();
      byId("communityListingPicker").hidden = active.length === 0;
    } catch(error){
      if(contextIsCurrent(context) && request === state.pickerRequest){
        select.replaceChildren(element("option", "", tr("marketplaceUnavailable")));
        select.disabled = true;
      }
    }
  }

  function selectCommunityListing(id){
    const listing = state.ownListings.find(item => listingId(item) === id && item.status === "active") || null;
    state.selectedCommunityListing = listing;
    const attachment = byId("communityListingAttachment");
    if(attachment){
      unloadRenderedMedia(attachment);
      attachment.replaceChildren();
      attachment.hidden = !listing;
      if(listing) attachment.append(linkedListingElement(listing));
    }
    const remove = byId("removeCommunityListing");
    if(remove) remove.hidden = !listing;
  }

  function clearCommunityListing(){
    state.selectedCommunityListing = null;
    const select = byId("communityListingSelect");
    if(select) select.value = "";
    const attachment = byId("communityListingAttachment");
    if(attachment){ unloadRenderedMedia(attachment); attachment.replaceChildren(); attachment.hidden = true; }
    if(byId("removeCommunityListing")) byId("removeCommunityListing").hidden = true;
  }

  function linkedListingElement(listing){
    const id = listingId(listing);
    const card = element("article", "marketplace-linked-listing");
    const media = normalizeMedia(listing.media);
    if(media[0]) card.append(privateMedia(media[0], {compact:true, context:currentContext(), controls:false}));
    const information = element("div", "marketplace-linked-information");
    if(listing.category) information.append(element("span", "marketplace-category-chip", labelFor("marketplaceCategory", listing.category)));
    information.append(element("strong", "", String(listing.title || tr("marketplaceListingUnavailable"))));
    if(listing.price_minor !== null && listing.price_minor !== undefined && listing.currency){
      information.append(element("span", "marketplace-card-price", listingPrice(listing)));
    } else if(listing.status){
      information.append(element("span", `marketplace-status-chip status-${String(listing.status)}`, listingStatusLabel(listing)));
    }
    const canOpen = listing.status === "active" || (listing.price_minor !== null && listing.price_minor !== undefined && !!listing.currency);
    if(canOpen){
      const open = element("button", "marketplace-card-action", tr("marketplaceViewListing"));
      open.type = "button";
      open.addEventListener("click", () => {
        const context = currentContext();
        if(typeof hub().switchView === "function") void Promise.resolve(hub().switchView("marketplace")).then(() => {
          if(contextIsCurrent(context)) return openListing(id, open);
          return null;
        });
        else void openListing(id, open);
      });
      information.append(open);
    }
    card.append(information);
    return card;
  }

  function renderLinkedListing(value, target=null){
    const listing = typeof value === "object" && value ? listingRecord(value) : null;
    if(!listing || !UUID_RE.test(listingId(listing))) return null;
    const card = linkedListingElement(listing);
    if(target instanceof Element) target.append(card);
    return card;
  }

  function reset(nextUserId=null){
    state.feedRequest += 1;
    state.detailRequest += 1;
    state.orderRequest += 1;
    state.pickerRequest += 1;
    state.editorOperation += 1;
    state.generation += 1;
    state.userId = nextUserId;
    state.active = false;
    state.scope = "campus";
    state.mode = "discover";
    state.query = "";
    state.category = "all";
    state.sort = "recent";
    state.offset = 0;
    state.hasMore = false;
    state.total = null;
    state.items = [];
    state.localItems = [];
    state.loading = false;
    state.busyListings.clear();
    state.busyOrders.clear();
    state.detail = null;
    state.order = null;
    state.returnFocus = null;
    state.orderReturnFocus = null;
    state.editorReturnFocus = null;
    state.editorListing = null;
    state.editorBusy = false;
    state.ownListings = [];
    state.selectedCommunityListing = null;
    if(state.searchTimer){ clearTimeout(state.searchTimer); state.searchTimer = null; }
    revokeEditorPreviews();
    revokeMediaUrls();
    byId("marketplaceGrid")?.replaceChildren();
    byId("marketplaceCatalogue")?.setAttribute("aria-busy", "false");
    byId("marketplaceDetailContent")?.replaceChildren();
    byId("marketplaceOrderContent")?.replaceChildren();
    if(byId("marketplaceDetailModal")) byId("marketplaceDetailModal").hidden = true;
    if(byId("marketplaceOrderModal")) byId("marketplaceOrderModal").hidden = true;
    if(byId("marketplaceListingEditorModal")) byId("marketplaceListingEditorModal").hidden = true;
    clearCommunityListing();
    const search = byId("marketplaceSearch");
    const category = byId("marketplaceCategory");
    const sort = byId("marketplaceSort");
    if(search){ search.value = ""; search.disabled = false; }
    if(category){ category.value = "all"; category.disabled = false; }
    if(sort){ sort.value = "recent"; sort.disabled = false; }
    syncScopeUi();
    document.querySelectorAll("#marketplaceModes [data-market-mode]").forEach(button => {
      const active = button.dataset.marketMode === "discover";
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
      if(active && button.id) byId("marketplaceCatalogue")?.setAttribute("aria-labelledby", button.id);
    });
    const listingSelect = byId("communityListingSelect");
    if(listingSelect){
      const empty = element("option", "", tr("marketplaceSelectListing"));
      empty.value = "";
      listingSelect.replaceChildren(empty);
      listingSelect.disabled = false;
    }
    if(byId("communityListingPicker")) byId("communityListingPicker").hidden = true;
    byId("marketplaceListingEditorForm")?.reset();
    setEditorBusy(false);
    byId("marketplaceMediaPreview")?.replaceChildren();
    setStatus("");
    updateResultsLabel(0);
    updateLoadMore();
  }

  async function syncAccess(){
    const nextUserId = typeof currentUser !== "undefined" ? currentUser?.id || null : null;
    if(nextUserId !== state.userId) reset(nextUserId);
    if(!nextUserId) return false;
    const listingMatch = window.location.hash.match(LISTING_HASH_RE);
    if(listingMatch && !marketplaceVisible() && typeof hub().show === "function"){
      hub().show("marketplace");
      return true;
    }
    if(marketplaceVisible() && !state.active) await activate();
    return true;
  }

  function closeTransientUi(){
    closeDetail({restoreFocus:false, clearHash:true});
    closeOrder({restoreFocus:false});
    if(!byId("marketplaceListingEditorModal")?.hidden) closeEditor({restoreFocus:false, force:true});
  }

  async function activate(){
    const nextUserId = typeof currentUser !== "undefined" ? currentUser?.id || null : null;
    if(!nextUserId){ reset(null); return false; }
    if(nextUserId !== state.userId) reset(nextUserId);
    state.active = true;
    await Promise.all([loadMarketplace({force:true}), loadCommunityListingChoices()]);
    const match = window.location.hash.match(LISTING_HASH_RE);
    if(match) await openListing(match[1]);
    return true;
  }

  function refreshLanguage(){
    syncScopeUi();
    syncGlobalVisibilityCopy();
    updateResultsLabel();
    updateLoadMore();
    renderGrid();
    if(state.detail) renderListingDetail(state.detail);
    if(state.order) renderOrder(state.order);
    if(!byId("marketplaceListingEditorModal")?.hidden){
      byId("marketplaceListingEditorTitle").textContent = tr(state.editorListing ? "marketplaceEditListing" : "marketplaceNewListing");
      renderEditorMedia();
    }
    if(state.selectedCommunityListing) selectCommunityListing(listingId(state.selectedCommunityListing));
  }

  function trapModalFocus(event){
    if(event.defaultPrevented) return;
    if((byId("hubActionModal") && !byId("hubActionModal").hidden) || (byId("schoolmateProfileModal") && !byId("schoolmateProfileModal").hidden)) return;
    const modals = [byId("marketplaceListingEditorModal"), byId("marketplaceDetailModal"), byId("marketplaceOrderModal")].filter(modal => modal && !modal.hidden);
    const modal = modals.at(-1);
    if(!modal) return;
    if(event.key === "Escape"){
      event.preventDefault();
      if(modal.id === "marketplaceListingEditorModal") closeEditor();
      else if(modal.id === "marketplaceDetailModal") closeDetail({clearHash:true});
      else closeOrder();
      return;
    }
    if(event.key !== "Tab") return;
    const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(item => !item.hidden && item.getAttribute("aria-hidden") !== "true");
    if(!focusable.length){ event.preventDefault(); modal.focus(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
    else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
  }

  function handleMarketplaceAction(event){
    const action = event.target.closest?.("[data-market-action]");
    if(!action || !event.currentTarget.contains(action) || action.disabled) return;
    if(action.dataset.marketAction === "sell"){
      if(state.scope !== "global") void openListingEditor(null, action);
      return;
    }
    if(action.dataset.marketAction !== "explore") return;
    const discover = byId("marketplaceTabDiscover");
    if(discover?.getAttribute("aria-selected") !== "true") discover.click();
    const catalogue = byId("marketplaceCatalogue");
    if(!catalogue) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    catalogue.scrollIntoView({behavior:reduceMotion ? "auto" : "smooth", block:"start"});
    window.requestAnimationFrame(() => catalogue.focus({preventScroll:true}));
  }

  function bindEvents(){
    ensureScopeControls();
    ensureGlobalVisibilityControl();
    syncScopeUi();
    document.querySelectorAll("#marketplaceModes [data-market-mode]").forEach(button => {
      button.tabIndex = button.dataset.marketMode === "discover" ? 0 : -1;
    });
    byId("memberHub")?.addEventListener("click", handleMarketplaceAction);
    byId("marketplaceScope")?.addEventListener("click", event => {
      const button = event.target.closest("[data-market-scope]");
      if(button) void setScope(button.dataset.marketScope);
    });
    byId("marketplaceAddMediaButton")?.addEventListener("click", () => byId("marketplaceMediaInput")?.click());
    byId("marketplaceEditorCancel")?.addEventListener("click", () => closeEditor());
    byId("marketplaceEditorCancelButton")?.addEventListener("click", () => closeEditor());
    byId("marketplaceListingEditorForm")?.addEventListener("submit", submitEditor);
    byId("marketplaceEditorSubmit")?.addEventListener("click", event => {
      if(event.currentTarget.type !== "submit") void submitEditor(event);
    });
    byId("marketplaceMediaInput")?.addEventListener("change", event => void prepareEditorMedia(event.target.files));
    byId("marketplaceCategoryInput")?.addEventListener("change", () => syncRightsBasisField());
    byId("marketplaceTypeInput")?.addEventListener("change", syncListingModeFields);
    byId("marketplaceDetailClose")?.addEventListener("click", () => closeDetail({clearHash:true}));
    byId("marketplaceOrderClose")?.addEventListener("click", () => closeOrder());
    byId("marketplaceDetailModal")?.addEventListener("click", event => { if(event.target === byId("marketplaceDetailModal")) closeDetail({clearHash:true}); });
    byId("marketplaceOrderModal")?.addEventListener("click", event => { if(event.target === byId("marketplaceOrderModal")) closeOrder(); });
    byId("marketplaceListingEditorModal")?.addEventListener("click", event => { if(event.target === byId("marketplaceListingEditorModal")) closeEditor(); });
    byId("marketplaceLoadMore")?.addEventListener("click", () => {
      if(["mine", "orders"].includes(state.mode)) loadNextLocalPage();
      else void loadMarketplace({append:true});
    });
    byId("marketplaceModes")?.addEventListener("click", event => {
      const button = event.target.closest("[data-market-mode]");
      if(button) void setMode(button.dataset.marketMode);
    });
    byId("marketplaceModes")?.addEventListener("keydown", event => {
      if(!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const buttons = [...event.currentTarget.querySelectorAll("[data-market-mode]")].filter(button => !button.hidden && !button.disabled);
      const index = buttons.indexOf(event.target.closest("[data-market-mode]"));
      if(index < 0 || !buttons.length) return;
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[nextIndex].focus();
      void setMode(buttons[nextIndex].dataset.marketMode);
    });
    byId("marketplaceSearch")?.addEventListener("input", event => {
      state.query = event.target.value.trim().slice(0, 120);
      if(state.searchTimer) clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(() => { state.searchTimer = null; void loadMarketplace({force:true}); }, 350);
    });
    byId("marketplaceSearch")?.addEventListener("keydown", event => {
      if(event.key === "Enter"){
        event.preventDefault();
        if(state.searchTimer){ clearTimeout(state.searchTimer); state.searchTimer = null; }
        state.query = event.currentTarget.value.trim().slice(0, 120);
        void loadMarketplace({force:true});
      }
    });
    byId("marketplaceCategory")?.addEventListener("change", event => { state.category = event.target.value || "all"; void loadMarketplace({force:true}); });
    byId("marketplaceSort")?.addEventListener("change", event => { state.sort = event.target.value || "recent"; void loadMarketplace({force:true}); });
    byId("communityListingSelect")?.addEventListener("change", event => selectCommunityListing(event.target.value));
    byId("removeCommunityListing")?.addEventListener("click", clearCommunityListing);
    document.addEventListener("keydown", trapModalFocus);
    window.addEventListener("hashchange", () => {
      const match = window.location.hash.match(LISTING_HASH_RE);
      if(match && state.userId){
        if(marketplaceVisible()) void openListing(match[1]);
        else if(typeof hub().show === "function") hub().show("marketplace");
        else if(typeof hub().switchView === "function") void Promise.resolve(hub().switchView("marketplace")).then(() => openListing(match[1]));
      } else if(!match && state.detail) closeDetail({restoreFocus:false});
    });
    window.addEventListener("beforeunload", revokeMediaUrls, {once:true});
  }

  window.ConCourseMarketplace = {
    activate,
    reset,
    refreshLanguage,
    syncAccess,
    closeTransientUi,
    selectedCommunityListingId:() => listingId(state.selectedCommunityListing) || null,
    clearCommunityListing,
    renderLinkedListing,
    shareListing,
    openListing
  };

  bindEvents();
  void syncAccess();
})();
