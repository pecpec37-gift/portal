/* =========================================================================
   Tommy-Go 対戦モード共有ライブラリ  (battle.js)
   ポータルrepo直下に置き、ポータルと各ゲームから読み込む（stamp.jsと同じ方式）
   読み込み例:  <script src="https://pecpec37-gift.github.io/portal/battle.js"></script>

   ★★★ 初回だけ必須の設定 ★★★
   下の FIREBASE_CONFIG を、あなたのFirebaseプロジェクトの設定に置き換えてください。
   （設定手順は別紙「対戦モード設定ガイド」を参照）
   ========================================================================= */
(function () {
  'use strict';

  /* ===== ① ここをあなたのFirebase設定に置き換える ===== */
  var FIREBASE_CONFIG = {
   apiKey: "AIzaSyCmmTKY3qSsmlS87M5LgxznFNjc-bsICo4",
   authDomain: "tommy-go-12d96.firebaseapp.com",
   databaseURL: "https://tommy-go-12d96-default-rtdb.firebaseio.com",
   projectId: "tommy-go-12d96",
   storageBucket: "tommy-go-12d96.firebasestorage.app",
   messagingSenderId: "836456815101",
   appId: "1:836456815101:web:177849862d1f922a382194"
  };
  /* =================================================== */

  // ===== 対戦対象ゲームの登録（ここに追加すれば対戦対象が増えます） =====
  // 相手が決まると、この中から1ゲームをランダム選択し、そのゲームのジャンルもランダムで両者に渡します。
  var GAMES = [
    {
      id: 'shinkei',
      name: '神経衰弱道場',
      icon: '🃏',
      url: 'https://pecpec37-gift.github.io/shinkei-suijaku/',
      genres: [
        { id: 'number',  icon: '🔢', name: '数字' },
        { id: 'animal',  icon: '🐶', name: '動物' },
        { id: 'fruit',   icon: '🍓', name: 'フルーツ' },
        { id: 'food',    icon: '🍜', name: 'たべもの' },
        { id: 'vehicle', icon: '🚗', name: 'のりもの' },
        { id: 'sport',   icon: '⚽', name: 'スポーツ' },
        { id: 'face',    icon: '😀', name: 'かお' },
        { id: 'nature',  icon: '🌸', name: 'しぜん' }
      ]
    },
    {
      id: 'meigen',
      name: '名言・スピーチクイズ道場',
      icon: '💬',
      url: 'https://pecpec37-gift.github.io/meigen-quiz/',
      genres: [
        { id: 'ijin',   icon: '🏛️', name: '偉人・歴史の名言' },
        { id: 'kagaku', icon: '🔬', name: '科学者・発明家の名言' },
        { id: 'keiei',  icon: '💼', name: '経営者・起業家の名言' },
        { id: 'sports', icon: '🏅', name: 'スポーツ選手の名言' },
        { id: 'bunka',  icon: '✒️', name: '作家・哲学者・芸術家' },
        { id: 'speech', icon: '🎤', name: '名スピーチ・名演説' }
      ]
    }
  ];
  function gameById(id){ for(var i=0;i<GAMES.length;i++){ if(GAMES[i].id===id) return GAMES[i]; } return null; }
  function genreOf(gameId, genreId){
    var g=gameById(gameId); if(!g) return null;
    for(var i=0;i<g.genres.length;i++){ if(g.genres[i].id===genreId) return g.genres[i]; }
    return null;
  }

  var SDK_BASE = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var db = null;
  var _readyResolve, _readyReject;
  var ready = new Promise(function (res, rej) { _readyResolve = res; _readyReject = rej; });

  /* ---- Firebase SDK を動的ロード ---- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('load failed: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function isConfigured() {
    return FIREBASE_CONFIG && FIREBASE_CONFIG.databaseURL &&
           FIREBASE_CONFIG.databaseURL.indexOf('YOUR_PROJECT') === -1;
  }

  (function init() {
    if (!isConfigured()) {
      console.warn('[TomyBattle] Firebase未設定です。battle.js の FIREBASE_CONFIG を設定してください。');
      _readyReject(new Error('not-configured'));
      return;
    }
    loadScript(SDK_BASE + 'firebase-app-compat.js')
      .then(function () { return loadScript(SDK_BASE + 'firebase-database-compat.js'); })
      .then(function () {
        try {
          firebase.initializeApp(FIREBASE_CONFIG);
          db = firebase.database();
          _readyResolve(db);
        } catch (e) { _readyReject(e); }
      })
      .catch(function (e) { _readyReject(e); });
  })();

  /* ---- プレーヤーID / 名前（端末内に保持） ---- */
  function getPid() {
    var k = 'tommygo_battle_pid';
    var v = localStorage.getItem(k);
    if (!v) {
      v = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(k, v);
    }
    return v;
  }
  function getName() { return localStorage.getItem('tommygo_battle_name') || ''; }
  function setName(n) { localStorage.setItem('tommygo_battle_name', (n || '').slice(0, 20)); }

  /* ---- ロビー ---- */
  var _lobbyRef = null, _myLobbyRef = null, _matchWatchRef = null;

  function joinLobby(name, onPlayers, onMatched) {
    setName(name);
    return ready.then(function () {
      var pid = getPid();
      _myLobbyRef = db.ref('lobby/' + pid);
      _myLobbyRef.set({ name: name, ts: firebase.database.ServerValue.TIMESTAMP });
      _myLobbyRef.onDisconnect().remove();

      // ロビー全体を購読（30秒以内に更新のあった待機者のみ表示）
      _lobbyRef = db.ref('lobby');
      _lobbyRef.on('value', function (snap) {
        var val = snap.val() || {};
        var now = Date.now();
        var list = [];
        Object.keys(val).forEach(function (id) {
          var p = val[id];
          if (!p || !p.name) return;
          if (p.matchId) return; // すでに対戦中は除外
          list.push({ id: id, name: p.name, self: id === pid });
        });
        // 本人を先頭に
        list.sort(function (a, b) { return (b.self ? 1 : 0) - (a.self ? 1 : 0); });
        if (onPlayers) onPlayers(list);
      });

      // 自分がマッチに入れられたら検知
      if (_matchWatchRef) _matchWatchRef.off();
      _matchWatchRef = db.ref('lobby/' + pid + '/matchId');
      _matchWatchRef.on('value', function (snap) {
        var mid = snap.val();
        if (mid && onMatched) {
          db.ref('matches/' + mid).once('value').then(function (ms) {
            onMatched(mid, ms.val());
          });
        }
      });
    });
  }

  function leaveLobby() {
    try {
      if (_lobbyRef) { _lobbyRef.off(); _lobbyRef = null; }
      if (_matchWatchRef) { _matchWatchRef.off(); _matchWatchRef = null; }
      if (_myLobbyRef) { _myLobbyRef.remove(); _myLobbyRef = null; }
    } catch (e) {}
  }

  /* ---- 相手を選んで対戦開始（テーマはここでランダム決定して両者に渡す） ---- */
  // 2人のIDから決まる「共有マッチID」を作る（どちらが選んでも同じIDになる）
  function pairMatchId(a, b) {
    var ids = [a, b].sort();
    return 'm_' + ids[0] + '__' + ids[1];
  }
  // 既存マッチを作り直すべきか（前回が完了済み or 放置で古い なら作り直す）
  function shouldRecreate(current, now) {
    if (!current || !current.startAt) return true;
    var pc = current.players ? Object.keys(current.players).length : 0;
    var sc = current.scores ? Object.keys(current.scores).length : 0;
    if (pc > 0 && sc >= pc) return true;              // 前回の対戦が完了 → 新しい対戦
    if (now - current.startAt > 120000) return true;   // 古い（放置）→ 作り直す
    return false;                                       // 進行中の対戦に「参加」＝同じゲームになる
  }

  function pickOpponent(oppId, oppName, opts) {
    opts = opts || {};
    return ready.then(function () {
      var pid = getPid();
      var myName = getName() || 'プレーヤー';
      var matchId = pairMatchId(pid, oppId);
      var matchRef = db.ref('matches/' + matchId);
      // トランザクションで「1つのマッチだけ」を作る／既にあれば参加する
      return matchRef.transaction(function (current) {
        var now = Date.now();
        if (shouldRecreate(current, now)) {
          var game = opts.gameId ? gameById(opts.gameId) : GAMES[Math.floor(Math.random() * GAMES.length)];
          if (!game) game = GAMES[0];
          var genre = opts.genreId || game.genres[Math.floor(Math.random() * game.genres.length)].id;
          var players = {};
          players[pid] = myName;
          players[oppId] = oppName;
          return {
            players: players,
            game: game.id,
            genre: genre,
            status: 'starting',
            createdBy: pid,
            createdAt: now,
            startAt: now + 10000
          };
        }
        // 既存の対戦が有効 → そのまま参加（上書きしない＝両者が同じゲーム・同じジャンル）
        return current;
      }).then(function (res) {
        var match = res.snapshot ? res.snapshot.val() : null;
        var updates = {};
        updates['lobby/' + pid + '/matchId'] = matchId;
        updates['lobby/' + oppId + '/matchId'] = matchId;
        return db.ref().update(updates).then(function () {
          return { matchId: matchId, match: match };
        });
      });
    });
  }

  /* ---- スコア送信（ゲーム終了時にゲーム側から呼ぶ） ---- */
  function submitScore(matchId, score, detail) {
    return ready.then(function () {
      var pid = getPid();
      var name = getName() || 'プレーヤー';
      var upd = {};
      upd['matches/' + matchId + '/scores/' + pid] = {
        name: name, score: score, detail: (detail || ''),
        ts: firebase.database.ServerValue.TIMESTAMP
      };
      return db.ref().update(upd);
    });
  }

  /* ---- マッチ購読（対戦結果画面用） ---- */
  function listenMatch(matchId, cb) {
    return ready.then(function () {
      var r = db.ref('matches/' + matchId);
      r.on('value', function (snap) { cb(snap.val(), matchId); });
      return function () { r.off(); };
    });
  }
  function getMatch(matchId) {
    return ready.then(function () {
      return db.ref('matches/' + matchId).once('value').then(function (s) { return s.val(); });
    });
  }
  // マッチ中フラグを消してロビーから離脱可能にする
  function clearMyMatchFlag() {
    return ready.then(function () {
      var pid = getPid();
      return db.ref('lobby/' + pid + '/matchId').remove().catch(function () {});
    });
  }

  window.TomyBattle = {
    ready: ready,
    isConfigured: isConfigured,
    GAMES: GAMES,
    gameById: gameById,
    genreOf: genreOf,
    getPid: getPid,
    getName: getName,
    setName: setName,
    joinLobby: joinLobby,
    leaveLobby: leaveLobby,
    pickOpponent: pickOpponent,
    submitScore: submitScore,
    listenMatch: listenMatch,
    getMatch: getMatch,
    clearMyMatchFlag: clearMyMatchFlag,
    PORTAL_URL: 'https://pecpec37-gift.github.io/portal/'
  };
})();
