#!/bin/bash
# 添加API代理到nginx配置

cd /usr/local/nginx/conf
cp nginx.conf nginx.conf.bak

# 在"# 留学服务网站"前添加API代理配置
awk '/# 留学服务网站/{
print "    # API接口代理"
print "    location /api/ {"
print "      proxy_pass http://localhost:3000/api/;"
print "      proxy_http_version 1.1;"
print "      proxy_set_header Authorization $http_authorization;"
print "      proxy_set_header Host $host;"
print "      proxy_set_header X-Real-IP $remote_addr;"
print "      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
print "    }"
print ""
}
1' nginx.conf > nginx.conf.new

mv nginx.conf.new nginx.conf
/usr/local/nginx/sbin/nginx -t && /usr/local/nginx/sbin/nginx -s reload
echo "✅ Nginx配置已更新并重载"
