#!/usr/bin/env python3
import requests
import json

url = 'http://localhost:3000/api/chat'
headers = {
    'Authorization': 'Bearer test_token',
    'Content-Type': 'application/json'
}
data = {
    'message': '你好，请介绍一下你自己'
}

try:
    print('发送请求到:', url)
    print('Headers:', headers)
    print('Data:', data)
    print()
    
    response = requests.post(url, headers=headers, json=data, timeout=30)
    
    print('状态码:', response.status_code)
    print('响应:', response.text[:500])
    
    if response.status_code == 200:
        result = response.json()
        if result.get('success'):
            print('\n✅ 成功！')
            print('AI回复:', result.get('reply', '')[:200])
        else:
            print('\n❌ 失败:', result.get('message'))
    else:
        print('\n❌ HTTP错误:', response.status_code)
        
except Exception as e:
    print('❌ 异常:', str(e))
