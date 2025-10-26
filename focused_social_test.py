#!/usr/bin/env python3

import requests
import json
from datetime import datetime

class FocusedSocialTest:
    def __init__(self):
        self.base_url = "https://org-posts-fixed.preview.emergentagent.com/api"
        self.token = None
        self.user_id = None
        self.post_id = None
        
    def setup_user(self):
        """Setup test user"""
        user_data = {
            "email": f"focused_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com",
            "password": "testpass123",
            "first_name": "Focused",
            "last_name": "Tester"
        }
        
        response = requests.post(f"{self.base_url}/auth/register", json=user_data)
        if response.status_code == 200:
            data = response.json()
            self.token = data['access_token']
            self.user_id = data['user']['id']
            print(f"✅ User setup successful: {self.user_id}")
            return True
        else:
            print(f"❌ User setup failed: {response.status_code}")
            return False
    
    def create_post(self):
        """Create test post"""
        headers = {'Authorization': f'Bearer {self.token}'}
        form_data = {'content': 'Test post for social features! 🚀'}
        
        response = requests.post(f"{self.base_url}/posts", data=form_data, headers=headers)
        if response.status_code == 200:
            data = response.json()
            self.post_id = data['id']
            print(f"✅ Post created: {self.post_id}")
            return True
        else:
            print(f"❌ Post creation failed: {response.status_code}")
            return False
    
    def test_comprehensive_social_workflow(self):
        """Test complete social workflow"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        print("\n🔍 Testing Comprehensive Social Workflow...")
        
        # 1. Like the post
        response = requests.post(f"{self.base_url}/posts/{self.post_id}/like", headers=headers)
        print(f"Like post: {response.status_code} - {response.json() if response.status_code == 200 else 'Failed'}")
        
        # 2. Add emoji reaction
        form_data = {'emoji': '👍'}
        response = requests.post(f"{self.base_url}/posts/{self.post_id}/reactions", data=form_data, headers=headers)
        print(f"Add reaction: {response.status_code} - {response.json() if response.status_code == 200 else 'Failed'}")
        
        # 3. Create comment
        form_data = {'content': 'Great post! 💬'}
        response = requests.post(f"{self.base_url}/posts/{self.post_id}/comments", data=form_data, headers=headers)
        comment_data = response.json() if response.status_code == 200 else {}
        comment_id = comment_data.get('id')
        print(f"Create comment: {response.status_code} - Comment ID: {comment_id}")
        
        # 4. Reply to comment
        if comment_id:
            form_data = {'content': 'Thanks for the comment! 🙏', 'parent_comment_id': comment_id}
            response = requests.post(f"{self.base_url}/posts/{self.post_id}/comments", data=form_data, headers=headers)
            print(f"Create reply: {response.status_code} - {response.json() if response.status_code == 200 else 'Failed'}")
        
        # 5. Like the comment
        if comment_id:
            response = requests.post(f"{self.base_url}/comments/{comment_id}/like", headers=headers)
            print(f"Like comment: {response.status_code} - {response.json() if response.status_code == 200 else 'Failed'}")
        
        # 6. Get enhanced posts data
        response = requests.get(f"{self.base_url}/posts", headers=headers)
        if response.status_code == 200:
            posts = response.json()
            for post in posts:
                if post['id'] == self.post_id:
                    print(f"Enhanced post data:")
                    print(f"  - likes_count: {post.get('likes_count')}")
                    print(f"  - comments_count: {post.get('comments_count')}")
                    print(f"  - user_liked: {post.get('user_liked')}")
                    print(f"  - user_reaction: {post.get('user_reaction')}")
                    print(f"  - top_reactions: {post.get('top_reactions')}")
                    break
        
        # 7. Get comments with nested structure
        response = requests.get(f"{self.base_url}/posts/{self.post_id}/comments", headers=headers)
        if response.status_code == 200:
            comments = response.json()
            print(f"Comments structure: {len(comments)} top-level comments")
            if comments:
                print(f"  - First comment has {len(comments[0].get('replies', []))} replies")
        
        # 8. Get notifications
        response = requests.get(f"{self.base_url}/notifications", headers=headers)
        if response.status_code == 200:
            notifications = response.json()
            print(f"Notifications: {len(notifications)} notifications found")
        
        # 9. Test allowed emojis
        allowed_emojis = ["👍", "❤️", "😂", "😮", "😢", "😡", "🔥", "👏", "🤔", "💯"]
        print(f"\nTesting allowed emojis: {allowed_emojis}")
        
        for emoji in allowed_emojis[:3]:  # Test first 3
            form_data = {'emoji': emoji}
            response = requests.post(f"{self.base_url}/posts/{self.post_id}/reactions", data=form_data, headers=headers)
            print(f"  {emoji}: {response.status_code}")
        
        # 10. Test invalid emoji
        form_data = {'emoji': '🚫'}
        response = requests.post(f"{self.base_url}/posts/{self.post_id}/reactions", data=form_data, headers=headers)
        print(f"Invalid emoji 🚫: {response.status_code} (should be 400)")
        
        print("\n✅ Comprehensive social workflow test completed!")

if __name__ == "__main__":
    tester = FocusedSocialTest()
    
    if tester.setup_user() and tester.create_post():
        tester.test_comprehensive_social_workflow()
    else:
        print("❌ Setup failed, cannot run tests")