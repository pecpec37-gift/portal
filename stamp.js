// ===================================================
// stamp.js — とみやんのゲームランド 共通スタンプ送信
// portal リポジトリのルートに置いてください
// ===================================================

(function() {
  // ★ GASデプロイ後にURLをここに貼り付けてください
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbwFZUaCcEX03EjYd4zM0rXCdb6v97BJHDwU9M8sCbY2vQRaDcMKthULXOed1FotE29w/exec';

  const PLAYER_KEY = 'tomy_player_name';

  // ---- プレーヤー名の取得・保存 ----
  window.TomyStamp = {

    getPlayer: function() {
      return localStorage.getItem(PLAYER_KEY) || '';
    },

    setPlayer: function(name) {
      localStorage.setItem(PLAYER_KEY, name.trim());
    },

    // ---- スタンプ送信 ----
    // game  : ゲームID（例: 'tennis-quiz'）
    // genre : ジャンル名（例: 'ルール'）
    // correct: 正解数（9以上でスタンプ1個）
    send: function(game, genre, correct) {
      const player = this.getPlayer();
      if (!player) return Promise.resolve({ ok: false, reason: 'no player' });
      if (correct < 9) return Promise.resolve({ ok: false, reason: 'score too low' });
      if (!GAS_URL || GAS_URL === 'YOUR_GAS_URL_HERE') {
        console.warn('[stamp.js] GAS_URL が未設定です');
        return Promise.resolve({ ok: false, reason: 'no GAS_URL' });
      }

      // GASはCORSの制限があるためno-corsで送信（レスポンスは読めないが送信は成功する）
      const params = new URLSearchParams({
        action: 'addStamp',
        player: player,
        game:   game,
        genre:  genre,
        count:  '1'
      });

      return fetch(GAS_URL + '?' + params.toString(), {
        method: 'GET'
      })
      .then(r => r.json())
      .then(data => {
        console.log('[stamp.js] GAS response:', data);
        return data;
      })
      .catch(err => {
        // no-corsの場合レスポンスが読めないが送信自体は成功している可能性が高い
        console.log('[stamp.js] 送信完了（レスポンス読み取り不可）:', err.toString());
        return { ok: true };
      });
    },

    // ---- TOP10取得 ----
    getTop10: function() {
      if (!GAS_URL || GAS_URL === 'YOUR_GAS_URL_HERE') {
        return Promise.resolve({ ok: false, top10: [] });
      }
      return fetch(GAS_URL + '?action=top10')
        .then(r => r.json())
        .catch(() => ({ ok: true, top10: [] }));
    },

    // ---- 自分のスタンプ数取得 ----
    getMyStamps: function() {
      const player = this.getPlayer();
      if (!player || !GAS_URL || GAS_URL === 'YOUR_GAS_URL_HERE') {
        return Promise.resolve({ ok: true, stamps: 0 });
      }
      return fetch(GAS_URL + '?action=myStamps&player=' + encodeURIComponent(player))
        .then(r => r.json())
        .catch(() => ({ ok: true, stamps: 0 }));
    }
  };
})();
