// ============================================================
// とみやんのゲームランド — 花形スタンプ共通ライブラリ
// portal リポジトリのルートに stamp.js として置いてください
// ============================================================

(function () {
  'use strict';

  // ★ デプロイ後にGASのウェブアプリURLに書き換えてください ★
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbyol40wCgQpNJxSOw2Zk4tGBO8W8M3Lv6twzzG34FYtrstQhc5dZhg_2eke9grSCpj_6Q/exec';

  // localStorage キー
  const LS_PLAYER = 'tomy_gl_player';

  // ---- プレーヤー名の取得 --------------------------------
  window.StampSystem = {

    // プレーヤー名をlocalStorageから取得（なければ空文字）
    getPlayer: function () {
      return localStorage.getItem(LS_PLAYER) || '';
    },

    // プレーヤー名をlocalStorageに保存
    setPlayer: function (name) {
      localStorage.setItem(LS_PLAYER, name.trim());
    },

    // ---- スタンプ送信 ------------------------------------
    // player  : プレーヤー名
    // game    : ゲームキー（例: 'tennis-quiz'）
    // correct : 正解数（数値）
    // callback: 結果を受け取る関数(省略可) { ok, stamp }
    send: function (player, game, correct, callback) {
      if (!player) return; // 名前なしは送信しない

      fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // GAS CORS対策
        body: JSON.stringify({ player, game, correct: Number(correct) })
      })
        .then(r => r.json())
        .then(data => {
          if (typeof callback === 'function') callback(data);
          // スタンプ獲得時にトースト表示
          if (data.stamp === 1) {
            StampSystem._toast('⭐ 花形スタンプ獲得！ポータルのTOP10に反映されます');
          }
        })
        .catch(() => { /* ネットワークエラーは無視 */ });
    },

    // ---- トースト通知 ------------------------------------
    _toast: function (msg) {
      const el = document.createElement('div');
      el.textContent = msg;
      Object.assign(el.style, {
        position:     'fixed',
        bottom:       '80px',
        left:         '50%',
        transform:    'translateX(-50%)',
        background:   'rgba(26,26,26,0.92)',
        color:        '#f0d060',
        fontFamily:   'sans-serif',
        fontSize:     '14px',
        padding:      '12px 20px',
        borderRadius: '4px',
        border:       '1px solid rgba(240,208,96,0.4)',
        zIndex:       '99999',
        whiteSpace:   'nowrap',
        boxShadow:    '0 4px 16px rgba(0,0,0,0.4)',
        transition:   'opacity 0.4s'
      });
      document.body.appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; }, 2500);
      setTimeout(() => { el.remove(); }, 3000);
    }
  };

})();
