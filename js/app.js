/* 仁德106天地：讀 data/content.json，把內容放進頁面。 */
(function () {
  "use strict";
  var WEEK = ["日", "一", "二", "三", "四", "五", "六"];

  // 今天（臺灣時間），回傳 {y,m,d,w,h,iso}
  function taipeiNow() {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false
    }).formatToParts(new Date());
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    var iso = o.year + "-" + o.month + "-" + o.day;
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, iso: iso, w: dayOf(iso) };
  }
  function toUTC(iso) { var a = iso.split("-"); return Date.UTC(+a[0], +a[1] - 1, +a[2]); }
  function dayOf(iso) { return new Date(toUTC(iso)).getUTCDay(); }
  function daysBetween(a, b) { return Math.round((toUTC(b) - toUTC(a)) / 86400000); }
  function md(iso) { var a = iso.split("-"); return (+a[1]) + "/" + (+a[2]); }
  function mdw(iso) { return md(iso) + "（" + WEEK[dayOf(iso)] + "）"; }
  function range(e) { return e.end && e.end !== e.start ? mdw(e.start) + "～" + mdw(e.end) : mdw(e.start); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function get(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function safeUrl(u) { return /^https:\/\//.test(u || "") ? u : ""; }

  var today = taipeiNow();

  // 聯絡簿日期格
  document.getElementById("d-m").textContent = today.m;
  document.getElementById("d-d").textContent = today.d;
  document.getElementById("d-w").textContent = WEEK[today.w];

  fetch("data/content.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(render)
    .catch(function () {
      var box = document.getElementById("notice-list");
      box.innerHTML = "";
      box.appendChild(el("p", "empty", "內容讀取失敗，請重新整理一次。"));
    });

  function render(c) {
    document.querySelectorAll("[data-bind]").forEach(function (n) {
      var v = get(c, n.getAttribute("data-bind"));
      if (typeof v === "string") n.textContent = v;
    });

    // 聯絡簿、LINE
    var cb = document.getElementById("cb-link");
    var cbUrl = safeUrl(get(c, "contactBook.url"));
    if (cbUrl) cb.href = cbUrl; else { cb.removeAttribute("href"); cb.setAttribute("aria-disabled", "true"); cb.lastChild.textContent = " 聯絡簿準備中"; }
    var ln = document.getElementById("line-link");
    var lnUrl = safeUrl(get(c, "line.url"));
    if (lnUrl) ln.href = lnUrl; else ln.hidden = true;

    renderGoal(c.goal);
    renderNotices(c.announcements || []);
    renderEvents(c.events || []);
    renderSchedule(c.schedule);
    renderRoutines(c.routines || []);

    // 活動照片
    var ph = document.getElementById("photos-link");
    var phUrl = safeUrl(get(c, "photos.url"));
    if (phUrl) {
      ph.href = phUrl; ph.target = "_blank"; ph.rel = "noopener";
      ph.classList.remove("is-soon"); ph.removeAttribute("aria-disabled");
      ph.querySelector("svg").setAttribute("stroke", "#2f7a6b");
      document.getElementById("photos-note").textContent = get(c, "photos.note") || "班級活動的照片";
    } else {
      document.getElementById("photos-note").textContent = "準備中，敬請期待";
    }
  }

  function renderNotices(list) {
    var box = document.getElementById("notice-list");
    box.innerHTML = "";
    var items = list.filter(function (a) { return a && a.title; })
      .sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    if (!items.length) {
      box.appendChild(el("p", "empty", "目前沒有新公告。有消息時老師會放在這裡。"));
      return;
    }
    items.forEach(function (a) {
      var row = el("article", "notice");
      var t = el("time", null, a.date ? md(a.date) : "");
      if (a.date) t.dateTime = a.date;
      var body = el("div");
      var h = el("h3", null, a.title);
      if (a.date) {
        var age = daysBetween(a.date, today.iso);
        if (age >= 0 && age <= 3) h.appendChild(el("span", "new", "新"));
      }
      body.appendChild(h);
      if (a.detail) body.appendChild(el("p", null, a.detail));
      row.appendChild(t); row.appendChild(body);
      box.appendChild(row);
    });
  }

  function renderEvents(list) {
    var upcoming = list.filter(function (e) { return e && e.start && (e.end || e.start) >= today.iso; })
      .sort(function (a, b) { return a.start.localeCompare(b.start); });

    var cd = document.getElementById("countdown");
    cd.innerHTML = "";
    var star = upcoming.filter(function (e) { return e.countdown; })[0];
    if (star) {
      var box = el("div", "count");
      var left = el("div");
      left.appendChild(el("small", null, star.title));
      left.appendChild(el("b", null, mdw(star.start)));
      var n = el("div", "n");
      var diff = daysBetween(today.iso, star.start);
      if (diff > 0) {
        n.textContent = diff;
        n.appendChild(el("small", null, "天"));
        n.setAttribute("aria-label", "還有 " + diff + " 天");
      } else {
        n.textContent = "就是今天";
        n.style.fontSize = "28px";
      }
      box.appendChild(left); box.appendChild(n);
      cd.appendChild(box);
    }

    var ol = document.getElementById("event-list");
    ol.innerHTML = "";
    if (!upcoming.length) {
      ol.hidden = true;
      cd.appendChild(el("p", "empty", "近期沒有排定的活動。"));
      return;
    }
    upcoming.forEach(function (e) {
      var li = el("li");
      if (e.start <= today.iso) li.className = "now";
      var t = el("time", null, range(e) + (e.start <= today.iso ? "　進行中" : ""));
      t.dateTime = e.start;
      li.appendChild(t);
      li.appendChild(el("h3", null, e.title));
      if (e.detail) li.appendChild(el("p", null, e.detail));
      ol.appendChild(li);
    });
  }

  function renderSchedule(s) {
    if (!s) return;
    var tbl = document.getElementById("sched");
    tbl.innerHTML = "";
    var col = today.w >= 1 && today.w <= 5 ? today.w : 0;
    var cg = el("colgroup");
    cg.appendChild(el("col", "c0"));
    for (var k = 0; k < 5; k++) cg.appendChild(el("col"));
    tbl.appendChild(cg);
    var thead = el("thead"), hr = el("tr");
    var corner = el("th", null, "節次"); corner.scope = "col"; hr.appendChild(corner);
    ["一", "二", "三", "四", "五"].forEach(function (d, i) {
      var th = el("th", i + 1 === col ? "today" : null, d);
      th.scope = "col";
      if (i + 1 === col) th.setAttribute("aria-label", "星期" + d + "（今天）");
      hr.appendChild(th);
    });
    thead.appendChild(hr); tbl.appendChild(thead);
    var tb = el("tbody");
    (s.periods || []).forEach(function (p) {
      var tr = el("tr");
      var th = el("th"); th.scope = "row";
      th.appendChild(el("b", null, p.name.replace(/第 | 節/g, "").replace("第", "")));
      th.appendChild(document.createTextNode(p.time.split("–")[0]));
      tr.appendChild(th);
      p.days.forEach(function (sub, i) {
        var cls = [];
        if (!sub) cls.push("off");
        if (i + 1 === col) cls.push("today");
        var td = el("td", cls.join(" ") || null);
        if (sub && sub.length === 4) {
          // 四個字的科目兩個字一組，窄螢幕換行時不會斷在中間
          td.appendChild(el("span", "w", sub.slice(0, 2)));
          td.appendChild(el("span", "w", sub.slice(2)));
        } else td.textContent = sub || "—";
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    var cap = el("caption", null, "一年六班課表，「—」表示已經放學");
    cap.style.cssText = "caption-side:bottom;font-size:13px;color:#665f54;padding-top:8px;text-align:left";
    tbl.appendChild(cap);

    var ul = document.getElementById("sched-notes");
    ul.innerHTML = "";
    (s.notes || []).forEach(function (t) { ul.appendChild(el("li", null, t)); });
  }

  function renderGoal(g) {
    var box = document.querySelector(".goal");
    if (!g || !g.title) { box.hidden = true; return; }
    var target = Math.max(1, Math.min(40, +g.target || 20));
    var pts = Math.max(0, Math.min(target, Math.floor(+g.points || 0)));
    document.getElementById("pts-count").textContent = pts + "／" + target + " 點";
    var ol = document.getElementById("pts");
    ol.innerHTML = "";
    ol.setAttribute("aria-label", "全班集點：已經 " + pts + " 點，集滿 " + target + " 點");
    for (var i = 1; i <= target; i++) {
      var li = el("li", i <= pts ? "on" : null);
      li.setAttribute("aria-hidden", "true");
      if (i <= pts) li.appendChild(el("span", null, "106"));
      ol.appendChild(li);
    }
    if (pts >= target) document.getElementById("pts-count").textContent = "集滿 " + target + " 點了！";
  }

  function renderRoutines(groups) {
    var box = document.getElementById("rules");
    box.innerHTML = "";
    groups.forEach(function (g) {
      var list = g.items || [g];
      if (g.group) box.appendChild(el("h3", "rule-g", g.group));
      var ul = el("ul", "rules");
      list.forEach(function (r) {
        var li = el("li"), d = el("div");
        d.appendChild(el("b", null, r.title));
        if (r.detail) d.appendChild(el("span", null, r.detail));
        li.appendChild(d);
        ul.appendChild(li);
      });
      box.appendChild(ul);
    });
  }

  // 對話框：開、關、點外面關
  document.querySelectorAll("[data-open]").forEach(function (b) {
    b.addEventListener("click", function () {
      var d = document.getElementById(b.getAttribute("data-open"));
      if (d && d.showModal) d.showModal();
    });
  });
  document.querySelectorAll("dialog").forEach(function (d) {
    d.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close")) { d.close(); return; }
      if (e.target !== d) return;
      var r = d.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) d.close();
    });
  });
})();
