(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const W = canvas.width, H = canvas.height;
  const groundY = 450;
  const stageWidth = 6200;

  const assets = {
    bg: new Image(),
    school: new Image(),
    magic: new Image(),
    enemy: new Image(),
    star: new Image(),
    cutSchool: document.getElementById('cutinSchool'),
    cutMagic: document.getElementById('cutinMagic'),
  };
  assets.bg.src = 'assets/bg_night.png';
  assets.school.src = 'assets/school_sheet.png';
  assets.magic.src = 'assets/magic_sheet.png';
  assets.enemy.src = 'assets/enemy_sheet.png';
  assets.star.src = 'assets/star.png';

  const ui = {
    panel: document.getElementById('centerPanel'),
    startBtn: document.getElementById('startBtn'),
    howBtn: document.getElementById('howBtn'),
    meterBar: document.getElementById('meterBar'),
    lifeText: document.getElementById('lifeText'),
    formText: document.getElementById('formText'),
    scoreText: document.getElementById('scoreText'),
    message: document.getElementById('message'),
    cutin: document.getElementById('cutin'),
    cutinText: document.getElementById('cutinText'),
  };

  const keys = new Set();
  const pressed = new Set();
  const tapState = new Map();

  const game = {
    started: false,
    over: false,
    clear: false,
    time: 0,
    score: 0,
    camX: 0,
    bgScroll: 0,
    cutinTimer: 0,
    transformLock: 0,
    messageTimer: 0,
    flashTimer: 0,
    bossSpawned: false,
    boss: null,
    groundPattern: [],
    obstacles: [],
    orbs: [],
    enemies: [],
    projectiles: [],
    particles: [],
  };

  const player = {
    x: 120,
    y: groundY - 96,
    vx: 0,
    vy: 0,
    w: 44,
    h: 96,
    facing: 1,
    onGround: false,
    hp: 5,
    maxHp: 5,
    form: 'school',
    transform: false,
    meter: 0,
    attackCd: 0,
    invuln: 0,
    anim: 0,
    animTime: 0,
  };

  function resetGame() {
    game.started = true;
    game.over = false;
    game.clear = false;
    game.time = 0;
    game.score = 0;
    game.camX = 0;
    game.bgScroll = 0;
    game.cutinTimer = 0;
    game.transformLock = 0;
    game.messageTimer = 0;
    game.flashTimer = 0;
    game.bossSpawned = false;
    game.boss = null;
    game.obstacles = [];
    game.orbs = [];
    game.enemies = [];
    game.projectiles = [];
    game.particles = [];

    player.x = 120;
    player.y = groundY - 96;
    player.vx = 0;
    player.vy = 0;
    player.facing = 1;
    player.onGround = false;
    player.hp = 5;
    player.form = 'school';
    player.transform = false;
    player.meter = 0;
    player.attackCd = 0;
    player.invuln = 0;
    player.anim = 0;
    player.animTime = 0;

    // create obstacles
    const obsXs = [620, 980, 1340, 1880, 2370, 2950, 3620, 4210, 4830, 5400];
    for (const ox of obsXs) {
      game.obstacles.push({ x: ox, y: groundY - 36, w: 56, h: 36, kind: Math.random() < 0.5 ? 'crystal' : 'crate' });
    }
    // orbs
    for (let i = 0; i < 28; i++) {
      game.orbs.push({
        x: 350 + i * 180 + (i % 3) * 40,
        y: 280 + Math.sin(i * 0.7) * 80,
        taken: false,
        phase: Math.random() * Math.PI * 2
      });
    }
    showMessage('準備完了。変身ゲージを溜めて進もう！', 2200);
    hidePanel();
  }

  function showPanel() { ui.panel.classList.add('show'); }
  function hidePanel() { ui.panel.classList.remove('show'); }

  function showMessage(text, ms=1600) {
    ui.message.textContent = text;
    ui.message.style.opacity = '1';
    game.messageTimer = ms / 1000;
  }

  function spawnParticles(x, y, color='rgba(255,220,120,1)', count=12, power=3) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * power + 0.5;
      game.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - Math.random() * 1.5,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 0.5 + Math.random() * 0.5,
        color,
        size: 2 + Math.random() * 3
      });
    }
  }

  function spawnEnemy(x) {
    game.enemies.push({
      x, y: groundY - 48,
      w: 32, h: 48,
      vx: -1.05 - Math.random() * 0.4,
      hp: 1,
      hit: 0,
      anim: Math.random() * 4,
      type: Math.random() < 0.75 ? 'slime' : 'bat'
    });
  }

  function spawnOrb(x, y) {
    game.orbs.push({ x, y, taken: false, phase: Math.random() * Math.PI * 2 });
  }

  function transformPlayer() {
    if (player.form === 'magic' || game.transformLock > 0 || player.meter < 100) return;
    game.transformLock = 2.0;
    game.cutinTimer = 1.9;
    game.flashTimer = 0.8;
    ui.cutin.classList.add('show');
    ui.cutinText.textContent = 'MAGIC TRANSFORM!';
    showMessage('変身開始！', 1000);
    setTimeout(() => {
      player.form = 'magic';
      player.transform = true;
      player.meter = 0;
      player.vx *= 0.7;
      ui.cutin.classList.remove('show');
      showMessage('魔法少女に変身！', 1800);
      spawnParticles(player.x + 24, player.y + 42, 'rgba(130,210,255,1)', 28, 4);
      game.transformLock = 0;
    }, 1200);
  }

  function damagePlayer(amount, sourceX) {
    if (player.invuln > 0 || game.over || game.clear) return;
    player.hp -= amount;
    player.invuln = 1.0;
    player.vx = (player.x < sourceX ? -5 : 5);
    player.vy = -4.5;
    spawnParticles(player.x + 20, player.y + 50, 'rgba(255,90,140,1)', 18, 4);
    if (player.hp <= 0) {
      player.hp = 0;
      game.over = true;
      showPanel();
      ui.panel.querySelector('h1').textContent = 'ゲームオーバー';
      ui.panel.querySelector('p').innerHTML = '敵にやられてしまった。<br>もう一度やるなら「スタート」か R キー。';
      ui.startBtn.textContent = 'リスタート';
    } else {
      showMessage('ダメージ！', 700);
    }
  }

  function drawSprite(sheet, frame, x, y, w, h, facing=1) {
    const sw = 32, sh = 48;
    const sx = frame * sw;
    ctx.save();
    if (facing < 0) {
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, sx, 0, sw, sh, 0, 0, w, h);
    } else {
      ctx.drawImage(sheet, sx, 0, sw, sh, x, y, w, h);
    }
    ctx.restore();
  }

  function drawHeart(x, y, filled=true) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(8, 20);
    ctx.bezierCurveTo(8, 11, 15, 7, 20, 12);
    ctx.bezierCurveTo(25, 7, 32, 11, 32, 20);
    ctx.bezierCurveTo(32, 31, 20, 38, 20, 38);
    ctx.bezierCurveTo(20, 38, 8, 31, 8, 20);
    ctx.closePath();
    ctx.fillStyle = filled ? '#ff7ca6' : 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function inView(obj, margin=80) {
    return obj.x + obj.w > game.camX - margin && obj.x < game.camX + W + margin;
  }

  function attack() {
    if (player.attackCd > 0 || game.over || game.clear || game.transformLock > 0) return;
    player.attackCd = player.form === 'magic' ? 0.24 : 0.42;
    if (player.form === 'school') {
      const range = 48;
      const hitX = player.facing > 0 ? player.x + player.w : player.x - range;
      const hitY = player.y + 24;
      game.projectiles.push({
        kind: 'slash',
        x: hitX,
        y: hitY - 8,
        w: range,
        h: 26,
        life: 0.08,
        dmg: 1,
        facing: player.facing
      });
      spawnParticles(hitX + (player.facing > 0 ? range : 0), hitY, 'rgba(255,215,130,1)', 8, 3);
    } else {
      const px = player.facing > 0 ? player.x + player.w + 4 : player.x - 14;
      game.projectiles.push({
        kind: 'bolt',
        x: px,
        y: player.y + 34,
        vx: player.facing * 8.5,
        w: 14,
        h: 10,
        life: 2.4,
        dmg: 1
      });
      spawnParticles(px, player.y + 36, 'rgba(140,220,255,1)', 6, 2.5);
    }
  }

  function updatePlayer(dt) {
    if (game.transformLock > 0) return;
    const accel = player.form === 'magic' ? 0.7 : 0.55;
    const maxSpeed = player.form === 'magic' ? 4.8 : 3.4;
    const friction = 0.84;
    const gravity = 0.34;
    const jump = player.form === 'magic' ? 8.8 : 8.0;

    let move = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) move -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) move += 1;
    if (move !== 0) player.facing = move > 0 ? 1 : -1;
    player.vx += move * accel;
    if (move === 0) player.vx *= friction;
    player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));

    if ((keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW')) && player.onGround && !pressed.has('jump')) {
      player.vy = -jump;
      player.onGround = false;
      pressed.add('jump');
    }
    if (!(keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW'))) pressed.delete('jump');

    if ((keys.has('KeyJ') || keys.has('KeyZ')) && !pressed.has('attack')) {
      attack();
      pressed.add('attack');
    }
    if (!(keys.has('KeyJ') || keys.has('KeyZ'))) pressed.delete('attack');

    if ((keys.has('KeyT')) && !pressed.has('transform')) {
      transformPlayer();
      pressed.add('transform');
    }
    if (!keys.has('KeyT')) pressed.delete('transform');

    if ((keys.has('KeyR')) && !pressed.has('restart')) {
      if (game.over || game.clear) {
        ui.panel.querySelector('h1').textContent = '魔法少女ランナー';
        ui.panel.querySelector('p').innerHTML = '普通の女子高生が、変身して魔法で戦う横スクロールアクション。<br>敵を倒して変身ゲージを溜め、<b>T</b> か画面ボタンで変身しよう。';
        ui.startBtn.textContent = 'スタート';
        resetGame();
      }
      pressed.add('restart');
    }
    if (!keys.has('KeyR')) pressed.delete('restart');

    player.vy += gravity;
    player.x += player.vx;
    player.y += player.vy;

    if (player.x < 24) {
      player.x = 24;
      player.vx = 0;
    }
    if (player.x > stageWidth - player.w - 20) {
      player.x = stageWidth - player.w - 20;
      player.vx = 0;
    }

    // ground
    if (player.y + player.h >= groundY) {
      player.y = groundY - player.h;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    // obstacle collision
    for (const ob of game.obstacles) {
      if (player.x + player.w > ob.x && player.x < ob.x + ob.w &&
          player.y + player.h > ob.y && player.y < ob.y + ob.h) {
        // simple resolution from top
        const prevBottom = player.y + player.h - player.vy;
        if (prevBottom <= ob.y + 6) {
          player.y = ob.y - player.h;
          player.vy = 0;
          player.onGround = true;
        } else if (player.x < ob.x) {
          player.x = ob.x - player.w;
          player.vx = Math.min(0, player.vx);
        } else {
          player.x = ob.x + ob.w;
          player.vx = Math.max(0, player.vx);
        }
      }
    }

    // pick orbs
    for (const orb of game.orbs) {
      if (orb.taken) continue;
      const dx = (orb.x - (player.x + player.w/2));
      const dy = (orb.y - (player.y + player.h/2));
      if (dx*dx + dy*dy < 34*34) {
        orb.taken = true;
        player.meter = Math.min(100, player.meter + 10);
        game.score += 20;
        spawnParticles(orb.x, orb.y, 'rgba(255,230,120,1)', 14, 3);
        showMessage('変身ゲージ +10', 600);
      }
    }

    // camera
    const targetCam = Math.max(0, Math.min(stageWidth - W, player.x - 280));
    game.camX += (targetCam - game.camX) * 0.12;
    game.bgScroll = game.camX * 0.18;
  }

  function updateEnemies(dt) {
    // spawn regular enemies
    if (!game.bossSpawned && Math.random() < 0.02) {
      const sx = game.camX + W + 160 + Math.random() * 500;
      if (sx < stageWidth - 300) spawnEnemy(sx);
    }
    // boss trigger
    if (!game.bossSpawned && player.x > 4200) {
      game.bossSpawned = true;
      game.boss = {
        x: game.camX + W + 180,
        y: groundY - 128,
        w: 92,
        h: 128,
        vx: -0.9,
        hp: 18,
        maxHp: 18,
        attackCd: 2.0,
        state: 'enter',
        invuln: 0
      };
      showMessage('ボス出現！', 1500);
    }

    if (game.boss) {
      const b = game.boss;
      if (b.x > game.camX + W - 180) b.x += b.vx * 2.0;
      else {
        b.x += b.vx;
        if (b.x < game.camX + 180) b.vx = 0.75;
        if (b.x > game.camX + 520) b.vx = -0.75;
      }
      b.attackCd -= dt;
      b.invuln = Math.max(0, b.invuln - dt);
      if (b.attackCd <= 0 && Math.random() < 0.02) {
        b.attackCd = 1.7 + Math.random() * 1.2;
        game.projectiles.push({
          kind: 'enemyBolt',
          x: b.x + b.w / 2,
          y: b.y + 56,
          vx: (player.x < b.x ? -4.2 : 4.2),
          vy: -0.5 + Math.random() * 0.5,
          w: 14, h: 14,
          life: 4.0,
          dmg: 1
        });
      }
    }

    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      e.x += e.vx;
      e.anim += dt * 10;
      if (Math.abs((player.x + player.w/2) - (e.x + e.w/2)) < 38 && Math.abs((player.y + player.h/2) - (e.y + e.h/2)) < 40) {
        damagePlayer(1, e.x);
      }
      if (e.x < game.camX - 150) game.enemies.splice(i, 1);
    }

    for (let i = game.projectiles.length - 1; i >= 0; i--) {
      const p = game.projectiles[i];
      p.life -= dt;
      if (p.kind === 'bolt' || p.kind === 'enemyBolt') {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
      }
      if (p.life <= 0) {
        game.projectiles.splice(i, 1);
        continue;
      }

      // projectile collisions
      if (p.kind === 'slash') {
        for (let j = game.enemies.length - 1; j >= 0; j--) {
          const e = game.enemies[j];
          if (rectsIntersect(p, e)) {
            game.enemies.splice(j, 1);
            game.projectiles.splice(i, 1);
            game.score += 50;
            player.meter = Math.min(100, player.meter + 18);
            spawnOrb(e.x + 10, e.y + 8);
            spawnParticles(e.x + 16, e.y + 20, 'rgba(255,205,120,1)', 18, 4);
            break;
          }
        }
        if (game.boss && rectsIntersect(p, game.boss)) {
          game.boss.hp -= 1;
          game.boss.invuln = 0.08;
          game.projectiles.splice(i, 1);
          game.score += 30;
          player.meter = Math.min(100, player.meter + 10);
          spawnParticles(game.boss.x + 40, game.boss.y + 50, 'rgba(255,205,120,1)', 10, 4);
          if (game.boss.hp <= 0) {
            game.clear = true;
            showPanel();
            ui.panel.querySelector('h1').textContent = 'ステージクリア！';
            ui.panel.querySelector('p').innerHTML = '魔法少女の勝利！<br>もう一度遊ぶなら「スタート」か R キー。';
            ui.startBtn.textContent = 'もう一度';
          }
        }
      } else if (p.kind === 'bolt') {
        for (let j = game.enemies.length - 1; j >= 0; j--) {
          const e = game.enemies[j];
          if (rectsIntersect(p, e)) {
            game.enemies.splice(j, 1);
            game.projectiles.splice(i, 1);
            game.score += 60;
            player.meter = Math.min(100, player.meter + 20);
            spawnParticles(e.x + 16, e.y + 20, 'rgba(140,220,255,1)', 20, 4);
            break;
          }
        }
        if (game.boss && rectsIntersect(p, game.boss) && game.boss.invuln <= 0) {
          game.boss.hp -= 1;
          game.boss.invuln = 0.08;
          game.projectiles.splice(i, 1);
          game.score += 45;
          player.meter = Math.min(100, player.meter + 10);
          spawnParticles(game.boss.x + 40, game.boss.y + 50, 'rgba(130,220,255,1)', 10, 4);
          if (game.boss.hp <= 0) {
            game.clear = true;
            showPanel();
            ui.panel.querySelector('h1').textContent = 'ステージクリア！';
            ui.panel.querySelector('p').innerHTML = '魔法少女の勝利！<br>もう一度遊ぶなら「スタート」か R キー。';
            ui.startBtn.textContent = 'もう一度';
          }
        }
      } else if (p.kind === 'enemyBolt') {
        if (rectsIntersect(p, player)) {
          game.projectiles.splice(i, 1);
          damagePlayer(1, p.x);
        }
      }
    }
  }

  function rectsIntersect(a, b) {
    return a.x < b.x + (b.w || 0) && a.x + (a.w || 0) > b.x &&
           a.y < b.y + (b.h || 0) && a.y + (a.h || 0) > b.y;
  }

  function updateParticles(dt) {
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.life -= dt;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.vx *= 0.99;
      if (p.life <= 0) game.particles.splice(i, 1);
    }
  }

  function updateUI() {
    ui.lifeText.textContent = 'HP ' + '♥'.repeat(player.hp) + '♡'.repeat(Math.max(0, player.maxHp - player.hp));
    ui.formText.textContent = player.form === 'school' ? '制服' : '魔法少女';
    ui.scoreText.textContent = 'SCORE ' + game.score;
    ui.meterBar.style.width = Math.min(100, player.meter) + '%';
    if (game.messageTimer > 0) {
      ui.message.style.opacity = '1';
    } else {
      ui.message.style.opacity = '0';
    }
  }

  function drawBackground() {
    const bg = assets.bg;
    const sx = Math.floor(game.bgScroll % bg.width);
    const scale = 1;
    // tile background image across screen
    for (let i = -1; i < 3; i++) {
      const x = -sx + i * bg.width;
      ctx.drawImage(bg, x, 0);
    }

    // parallax moons/parrots? some moving stars
    ctx.save();
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 36; i++) {
      const x = ((i * 260) - game.camX * 0.4) % (W + 200) - 50;
      const y = 70 + (i % 6) * 25;
      ctx.drawImage(assets.star, x, y, 10, 10);
    }
    ctx.restore();

    // ground
    ctx.fillStyle = '#0b0c18';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = '#151728';
    ctx.fillRect(0, groundY - 10, W, 10);

    // repeated platform line
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    for (let x = 0; x <= W; x += 32) {
      ctx.moveTo(x, groundY + 1);
      ctx.lineTo(x + 16, groundY + 1);
    }
    ctx.stroke();
  }

  function drawWorld() {
    drawBackground();

    // obstacles
    for (const ob of game.obstacles) {
      if (!inView(ob, 50)) continue;
      const x = Math.round(ob.x - game.camX);
      const y = ob.y;
      if (ob.kind === 'crate') {
        ctx.fillStyle = '#51382d';
        ctx.fillRect(x, y, ob.w, ob.h);
        ctx.strokeStyle = '#7b5b48';
        ctx.strokeRect(x + 1, y + 1, ob.w - 2, ob.h - 2);
        ctx.fillStyle = '#7f5f4f';
        ctx.fillRect(x + 4, y + 4, ob.w - 8, 4);
      } else {
        ctx.fillStyle = '#223b68';
        ctx.beginPath();
        ctx.moveTo(x + ob.w/2, y);
        ctx.lineTo(x + ob.w, y + ob.h);
        ctx.lineTo(x, y + ob.h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#80d8ff';
        ctx.beginPath();
        ctx.arc(x + ob.w/2, y + 13, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // orbs
    for (const orb of game.orbs) {
      if (orb.taken || !inView(orb, 60)) continue;
      const x = orb.x - game.camX;
      const y = orb.y + Math.sin(game.time * 3 + orb.phase) * 4;
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(assets.star, x - 8, y - 8, 22, 22);
      ctx.restore();
    }

    // enemies
    for (const e of game.enemies) {
      if (!inView(e, 60)) continue;
      const x = e.x - game.camX;
      const y = e.y;
      const frame = Math.floor(e.anim) % 4;
      drawSprite(assets.enemy, frame, x, y, 48, 72, e.vx >= 0 ? 1 : -1);
    }

    // boss
    if (game.boss) {
      const b = game.boss;
      if (b.x + b.w > game.camX - 100 && b.x < game.camX + W + 100) {
        const x = b.x - game.camX;
        const y = b.y;
        ctx.save();
        ctx.globalAlpha = b.invuln > 0 ? 0.6 : 1;
        // draw as bigger shadow witch using repeated enemy frame, plus aura
        ctx.fillStyle = 'rgba(60, 30, 100, 0.45)';
        ctx.beginPath();
        ctx.ellipse(x + 46, y + 92, 54, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(assets.magic, 0, 0, 32, 48, x + 10, y + 8, 72, 108);
        ctx.globalAlpha = 0.35;
        ctx.drawImage(assets.enemy, 0, 0, 32, 48, x + 28, y + 26, 48, 72);
        ctx.restore();

        // boss HP bar
        const barW = 260;
        const ratio = Math.max(0, b.hp / b.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(W/2 - barW/2, 16, barW, 16);
        ctx.fillStyle = '#ff6f9b';
        ctx.fillRect(W/2 - barW/2 + 2, 18, (barW - 4) * ratio, 12);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(W/2 - barW/2, 16, barW, 16);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px system-ui';
        ctx.fillText('BOSS', W/2 - 22, 28);
      }
    }

    // player
    const px = Math.round(player.x - game.camX);
    const py = Math.round(player.y);
    const frame = player.form === 'magic'
      ? (player.onGround ? (player.vx !== 0 ? Math.floor(game.time * 12) % 3 : 0) : 2)
      : (player.onGround ? (player.vx !== 0 ? Math.floor(game.time * 10) % 3 : 0) : 2);

    if (player.invuln > 0 && Math.floor(game.time * 20) % 2 === 0) ctx.globalAlpha = 0.5;
    drawSprite(player.form === 'magic' ? assets.magic : assets.school, frame, px, py, 72, 108, player.facing);
    ctx.globalAlpha = 1;

    // player aura
    if (player.form === 'magic') {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(game.time * 4) * 0.08;
      ctx.beginPath();
      ctx.arc(px + 36, py + 75, 42, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(130,220,255,0.4)';
      ctx.fill();
      ctx.restore();
    }

    // projectiles
    for (const p of game.projectiles) {
      const x = p.x - game.camX;
      if (p.kind === 'slash') {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = 'rgba(255,220,120,0.95)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        if (p.facing > 0) {
          ctx.arc(x + 8, p.y + 10, 18, -0.65, 0.9);
        } else {
          ctx.arc(x + p.w - 8, p.y + 10, 18, 2.3, 3.9);
        }
        ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'bolt') {
        ctx.fillStyle = '#8fe5ff';
        ctx.beginPath();
        ctx.arc(x, p.y, 5, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, p.y, 2, 0, Math.PI*2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ff99bf';
        ctx.beginPath();
        ctx.arc(x, p.y, 5, 0, Math.PI*2);
        ctx.fill();
      }
    }

    // particles
    for (const p of game.particles) {
      const x = p.x - game.camX;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(x, p.y, p.size, p.size);
      ctx.restore();
    }

    // finish line indicator
    const lineX = stageWidth - 120 - game.camX;
    if (lineX > -40 && lineX < W + 40) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(lineX, 0, 4, H);
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px system-ui';
      ctx.fillText('FINISH', lineX - 20, 44);
      ctx.restore();
    }

    // overlay prompts
    if (!player.transform && player.meter >= 100 && !game.over && !game.clear && game.transformLock <= 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(W/2 - 130, H - 86, 260, 42);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.strokeRect(W/2 - 130, H - 86, 260, 42);
      ctx.fillStyle = '#fff4c5';
      ctx.font = 'bold 18px system-ui';
      ctx.fillText('Tで変身できる！', W/2 - 67, H - 59);
      ctx.restore();
    }

    if (game.over) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 44px system-ui';
      ctx.fillText('GAME OVER', W/2 - 128, H/2 - 10);
      ctx.font = '18px system-ui';
      ctx.fillText('R で再挑戦', W/2 - 48, H/2 + 24);
      ctx.restore();
    }
    if (game.clear) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 44px system-ui';
      ctx.fillText('STAGE CLEAR', W/2 - 146, H/2 - 10);
      ctx.font = '18px system-ui';
      ctx.fillText('R で再挑戦', W/2 - 48, H/2 + 24);
      ctx.restore();
    }
  }

  function update(dt) {
    if (!game.started) return;

    game.time += dt;
    if (game.messageTimer > 0) {
      game.messageTimer -= dt;
      if (game.messageTimer <= 0) ui.message.style.opacity = '0';
    }

    if (game.cutinTimer > 0) {
      game.cutinTimer -= dt;
      const a = Math.max(0, Math.min(1, game.cutinTimer / 1.9));
      ui.cutin.style.opacity = 1;
      ui.cutin.querySelector('.flash').style.opacity = String(Math.max(0, 1 - a * 1.2));
    }

    if (!game.over && !game.clear && game.transformLock <= 0) {
      updatePlayer(dt);
      updateEnemies(dt);
      updateParticles(dt);

      player.attackCd = Math.max(0, player.attackCd - dt);
      player.invuln = Math.max(0, player.invuln - dt);

      // small automatic meter gain in magic form while moving
      if (player.form === 'magic' && (Math.abs(player.vx) > 0.5 || !player.onGround)) {
        player.meter = Math.min(100, player.meter + dt * 4.5);
      } else if (player.form === 'school' && Math.abs(player.vx) > 0.5) {
        player.meter = Math.min(100, player.meter + dt * 1.4);
      }

      // boss-related ambient sparkles
      if (game.boss && Math.random() < 0.05) {
        spawnParticles(game.boss.x + 40 + Math.random()*30, game.boss.y + 30 + Math.random()*60, 'rgba(255,120,165,0.9)', 2, 1.5);
      }
    } else {
      updateParticles(dt);
      player.invuln = Math.max(0, player.invuln - dt);
    }

    if (game.bossSpawned && game.boss && game.boss.hp <= 0) {
      game.boss = null;
    }

    updateUI();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawWorld();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // Controls
  window.addEventListener('keydown', e => {
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'Enter' && (game.over || game.clear || !game.started)) {
      ui.panel.querySelector('h1').textContent = '魔法少女ランナー';
      ui.panel.querySelector('p').innerHTML = '普通の女子高生が、変身して魔法で戦う横スクロールアクション。<br>敵を倒して変身ゲージを溜め、<b>T</b> か画面ボタンで変身しよう。';
      ui.startBtn.textContent = 'スタート';
      resetGame();
    }
  }, { passive: false });

  window.addEventListener('keyup', e => {
    keys.delete(e.code);
  });

  // touch buttons
  const touchButtons = [...document.querySelectorAll('#touch button')];
  for (const btn of touchButtons) {
    const code = btn.dataset.key;
    const down = (ev) => {
      ev.preventDefault();
      keys.add(code);
      tapState.set(code, true);
      if (code === 'KeyT') transformPlayer();
      if ((code === 'KeyJ' || code === 'KeyZ')) attack();
      if (code === 'KeyR' && (game.over || game.clear)) {
        ui.panel.querySelector('h1').textContent = '魔法少女ランナー';
        ui.panel.querySelector('p').innerHTML = '普通の女子高生が、変身して魔法で戦う横スクロールアクション。<br>敵を倒して変身ゲージを溜め、<b>T</b> か画面ボタンで変身しよう。';
        ui.startBtn.textContent = 'スタート';
        resetGame();
      }
      if (code === 'Space' && player.onGround) {
        player.vy = -(player.form === 'magic' ? 8.8 : 8.0);
        player.onGround = false;
      }
    };
    const up = (ev) => {
      ev.preventDefault();
      keys.delete(code);
      tapState.delete(code);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
  }

  ui.startBtn.addEventListener('click', () => {
    ui.panel.querySelector('h1').textContent = '魔法少女ランナー';
    ui.panel.querySelector('p').innerHTML = '普通の女子高生が、変身して魔法で戦う横スクロールアクション。<br>敵を倒して変身ゲージを溜め、<b>T</b> か画面ボタンで変身しよう。';
    ui.startBtn.textContent = 'スタート';
    resetGame();
  });

  ui.howBtn.addEventListener('click', () => {
    hidePanel();
    if (!game.started) resetGame();
  });

  // Start the render loop right away; images will appear as soon as they load.
  requestAnimationFrame(loop);

  // Initial UI
  ui.message.textContent = 'スタートを押して開始';
  ui.message.style.opacity = '1';
  updateUI();
})();