// 视频卡片点击事件处理
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎬 视频网站前端脚本加载完成');
    
    // 为所有视频卡片添加点击事件
    const videoCards = document.querySelectorAll('.video-card');
    videoCards.forEach(card => {
        card.addEventListener('click', function(e) {
            e.preventDefault();
            const videoId = this.dataset.videoId;
            if (videoId) {
                console.log('点击视频卡片:', videoId);
                window.location.href = '/video/' + videoId;
            } else {
                console.error('视频ID不存在');
            }
        });
    });
    
    // UP主链接点击处理
    const uploaderLinks = document.querySelectorAll('.uploader-link');
    uploaderLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.stopPropagation(); // 阻止冒泡到视频卡片
            const uid = this.dataset.uid;
            if (uid) {
                window.location.href = '/space/' + uid;
            }
        });
    });
    
    // 播放量数字格式化
    function formatViews(views) {
        if (views >= 10000) {
            return Math.floor(views / 1000) / 10 + '万';
        }
        return views.toString();
    }
    
    // 更新所有播放量显示
    const viewsElements = document.querySelectorAll('.views-count');
    viewsElements.forEach(el => {
        const views = parseInt(el.textContent);
        if (!isNaN(views)) {
            el.textContent = formatViews(views);
        }
    });
});