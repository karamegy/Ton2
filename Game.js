const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

// --- إعدادات اللعبة الأساسية ---
let score = 0;
let isGameOver = false;
let animationId;

// إعداد حجم الـ Canvas لملء الشاشة
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- خصائص اللاعب (طرزان) ---
const player = {
    x: 100,
    y: canvas.height - 200,
    width: 50,
    height: 80,
    color: '#8e44ad', // لون بنفسجي يمثل طرزان مؤقتاً
    speed: 8,
    jumpForce: 18, // قوة القفز
    velocityY: 0,
    velocityX: 0,
    isJumping: false,
    facingRight: true
};

// --- خصائص البيئة (المنصات/الأشجار) ---
const platforms = [
    // الأرضية
    { x: 0, y: canvas.height - 30, width: canvas.width, height: 30, color: '#27ae60' },
    
    // منصات عائمة (أشجار)
    { x: 300, y: canvas.height - 150, width: 200, height: 20, color: '#27ae60' }, // غصن
    { x: 650, y: canvas.height - 280, width: 150, height: 20, color: '#27ae60' }, // غصن أعلى
    { x: 950, y: canvas.height - 400, width: 250, height: 20, color: '#27ae60' }, // غصن أعلى
    { x: 1300, y: canvas.height - 200, width: 180, height: 20, color: '#27ae60' } // غصن بعيد
];

// --- الفيزياء ---
const gravity = 0.8;

// --- التحكم ---
const keys = {
    right: false,
    left: false,
    up: false // للقفز
};

// الاستماع للأزرار
window.addEventListener('keydown', (e) => {
    if (isGameOver) return;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if ((e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') && !player.isJumping) {
        keys.up = true;
        player.velocityY = -player.jumpForce; // بدء القفز
        player.isJumping = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') keys.up = false;
});

// --- الدوال الرئيسية للعبة ---

// 1. دالة الرسم (Render)
function draw() {
    // مسح الشاشة في كل إطار
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // رسم المنصات (الأشجار)
    platforms.forEach(platform => {
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });

    // رسم اللاعب (طرزان)
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // تأثير بسيط لإظهار الاتجاه
    ctx.fillStyle = player.facingRight ? 'yellow' : 'white'; // العيون
    ctx.fillRect(player.x + (player.facingRight ? 35 : 5), player.y + 20, 10, 10);
}

// 2. دالة التحديث (Update Physics)
function update() {
    if (isGameOver) return;

    // تطبيق الجاذبية
    player.velocityY += gravity;
    player.y += player.velocityY;

    // حركة اللاعب يميناً ويساراً
    if (keys.right) {
        player.x += player.speed;
        player.facingRight = true;
    }
    if (keys.left) {
        player.x -= player.speed;
        player.facingRight = false;
    }
    
    // منع اللاعب من الخروج من الشاشة
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
    if (player.y > canvas.height + 100) { // سقط خارج الشاشة
        gameOver();
    }

    // كشف التصادم (Collision Detection) مع المنصات
    player.isJumping = true; // نفترض أنه في الهواء حتى يثبت العكس
    platforms.forEach(platform => {
        // التحقق إذا كان اللاعب فوق المنصة ويصطدم بها
        if (
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width &&
            player.y + player.height > platform.y &&
            player.y + player.height < platform.y + platform.height + player.velocityY + 2 // هام جداً لحساب الارتطام الدقيق
        ) {
            player.velocityY = 0; // إيقاف السقوط
            player.y = platform.y - player.height; // ضبط موقع اللاعب فوق المنصة
            player.isJumping = false; // لم يعد يقفز
            keys.up = false;
        }
    });
    
    // تحديث النتيجة (مثال بسيط: كلما تحرك لليمين تزيد النتيجة)
    if (keys.right && !player.isJumping) {
        score++;
        scoreElement.innerText = "النتيجة: " + score;
    }
}

// 3. حلقة اللعبة (Game Loop)
function gameLoop() {
    update();
    draw();
    if (!isGameOver) {
        animationId = requestAnimationFrame(gameLoop);
    }
}

// 4. وظائف إضافية
function gameOver() {
    isGameOver = true;
    cancelAnimationFrame(animationId);
    
    // عرض شاشة انتهاء اللعبة
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '50px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("لقد سقطت! انتهت اللعبة.", canvas.width/2, canvas.height/2);
    
    // إضافة زر إعادة المحاولة (اختياري)
    setTimeout(() => {
        if(confirm("هل تريد إعادة المحاولة؟")) {
            location.reload();
        }
    }, 500);
}

// بدء اللعبة
gameLoop();
