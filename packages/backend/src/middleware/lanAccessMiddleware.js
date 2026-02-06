/**
 * LAN访问限制中间件
 * 只允许局域网IP访问，拒绝外网访问
 */

const isPrivateIP = require('private-ip');
const logger = require('../config/logger');

/**
 * 获取客户端真实IP地址
 * 处理反向代理等情况
 */
function getClientIP(req) {
    // 优先从X-Forwarded-For获取（如果使用了反向代理）
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ips = forwarded.split(',').map(ip => ip.trim());
        return ips[0]; // 取第一个IP（最原始的客户端IP）
    }
    
    // 从X-Real-IP获取（Nginx等常用）
    if (req.headers['x-real-ip']) {
        return req.headers['x-real-ip'];
    }
    
    // 直接从连接获取
    return req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
}

/**
 * 检查IP是否为本地/局域网IP
 */
function isLocalOrPrivateIP(ip) {
    if (!ip) {
        return false;
    }
    
    // 处理IPv6的::ffff:前缀
    const cleanIP = ip.replace(/^::ffff:/, '');
    
    // localhost检查
    if (cleanIP === '127.0.0.1' || cleanIP === '::1' || cleanIP === 'localhost') {
        return true;
    }
    
    return isPrivateIP(cleanIP);
}

/**
 * LAN访问限制中间件
 * @param {Object} etcConfig - 配置对象
 */
function lanAccessMiddleware(etcConfig) {
    // 如果未启用LAN限制，直接放行
    if (!etcConfig || !etcConfig.lan_only) {
        return (req, res, next) => next();
    }
    
    return (req, res, next) => {
        const clientIP = getClientIP(req);
        
        if (isLocalOrPrivateIP(clientIP)) {
            // 是局域网IP，放行
            next();
        } else {
            // 外网IP，拒绝访问
            logger.warn(`[LAN Access] 拒绝外网访问: ${clientIP}, 请求路径: ${req.path}`);
            res.status(403).send({
                failed: true,
                reason: 'Access denied. This service is only available within LAN.',
                clientIP: clientIP
            });
        }
    };
}

module.exports = lanAccessMiddleware;
