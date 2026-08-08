const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hudElement = document.getElementById('hud');

let score = 0;
let isGameOver = false;
let animationId;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// شخصية طرزان (تطوير المحاكاة)
const player = {
    x: 120,
    y: canvas.height - 250,
    width: 45,
    height: 75,
    color: '#e67e22', // طابع مغامر الأمازون
    speed: 7,
    jumpForce: 16,
    velocityY: 0,
    isJumping: false,
    facingRight: true
};

// أشجار وفروع الأمازون (المنصات التفاعلية)
const platforms = [
    { x: 0, y: canvas.height - 40, width: canvas.width, height: 40, color: '#145a32' },
    { x: 250, y: canvas.height - 160, width: 220, height: 22, color: '#1e8449' },
    { x: 580, y: canvas.height - 290, width: 180, height: 22, color: '#1e8449' },
    { x: 860, y: canvas.height - 420, width: 240, height: 22, color: '#1e8449' },
    { x: 1200, y: canvas.height - 240, width: 200, height: 22, color: '#1e8449' }
];

const gravity = 0.75;
const keys = { right: false, left: false, up: false };

window.addEventListener('keydown', (e) => {
    if (isGameOver) return;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if ((e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') && !player.isJumping) {
        player.velocityY = -player.jumpForce;
        player.isJumping = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
});

// --- الدالة المطلوبة للتحكم بالحدث الرئيسي ونهاية التحدي ---
function triggerGameOver() {
    isGameOver = true;
    cancelAnimationFrame(animationId);
    
    ctx.fillStyle = 'rgba(11, 26, 18, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 45px "Segoe UI"';
    ctx.textAlign = 'center';
    ctx.fillText("لقد ابتلعتك أسرار الغامضة للأمازون!", canvas.width / 2, canvas.height / 2 - 30);
    
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '22px "Segoe UI"';
    ctx.fillText("اضغط لتجديد المحاولة أو العودة", canvas.width / 2, canvas.height / 2 + 25);

    setTimeout(() => {
        if(confirm("هل تود خوض المغامرة من جديد؟")) {
            location.reload();
        } else {
            window.location.href = 'index.html';
        }
    }, 400);
}

function updatePhysics() {
    if (isGameOver) return;

    player.velocityY += gravity;
    player.y += player.velocityY;

    if (keys.right) { player.x += player.speed; player.facingRight = true; }
    if (keys.left) { player.x -= player.speed; player.facingRight = false; }

    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
    
    // فحص السقوط خارج الشاشة
    if (player.y > canvas.height + 80) {
        triggerGameOver();
    }

    // فحص الارتطام بالأشجار والفروع
    player.isJumping = true;
    platforms.forEach(p => {
        if (
            player.x + player.width > p.x &&
            player.x < p.x + p.width &&
            player.y + player.height > p.y &&
            player.y + player.height < p.y + p.height + player.velocityY + 4
        ) {
            player.velocityY = 0;
            player.y = p.y - player.height;
            player.isJumping = false;
        }
    });

    if (keys.right && !player.isJumping) {
        score += 2;
        hudElement.innerText = "النتيجة: " + score;
    }
}

function renderScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // رسم الفروع والأشجار
    platforms.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.width, p.height);
        // إضافة خط سفلي يوحي بجذور الأشجار
        ctx.fillStyle = '#0e3a1f';
        ctx.fillRect(p.x, p.y + p.height - 5, p.width, 5);
    });

    // رسم شخصية المغامر
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // تفاصيل الوجه والعيون حسب الاتجاه
    ctx.fillStyle = '#f1c40f';
    let eyeOffset = player.facingRight ? 30 : 8;
    ctx.fillRect(player.x + eyeOffset, player.y + 15, 8, 8);
}

function mainGameLoop() {
    updatePhysics();
    renderScene();
    if (!isGameOver) {
        animationId = requestAnimationFrame(mainGameLoop);
    }
}

mainGameLoop();
