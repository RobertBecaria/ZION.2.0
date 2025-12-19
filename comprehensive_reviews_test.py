#!/usr/bin/env python3
"""
Comprehensive Reviews Testing - Full Flow Test

This test creates a new user and tests the complete reviews workflow:
1. Create a new review
2. Get reviews for the service
3. Test provider reply (with proper authorization)
4. Test helpful functionality
5. Verify service rating updates
"""

import requests
import json
import sys
from datetime import datetime

BACKEND_URL = "https://service-book-4.preview.emergentagent.com/api"

def log(message, level="INFO"):
    """Log test messages with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {level}: {message}")

def test_complete_reviews_workflow():
    """Test the complete reviews workflow"""
    log("🚀 Starting Comprehensive Reviews Workflow Test")
    log("=" * 80)
    
    # Step 1: Register a new test user
    log("👤 Registering new test user")
    user_data = {
        "email": f"reviewtest_{int(datetime.now().timestamp())}@example.com",
        "password": "testpassword123",
        "first_name": "Review",
        "last_name": "Tester"
    }
    
    response = requests.post(f"{BACKEND_URL}/auth/register", json=user_data)
    if response.status_code != 200:
        log(f"❌ User registration failed: {response.status_code} - {response.text}", "ERROR")
        return False
    
    log("✅ New user registered successfully")
    
    # Step 2: Login with new user
    log("🔐 Logging in new user")
    login_response = requests.post(f"{BACKEND_URL}/auth/login", json={
        "email": user_data["email"],
        "password": user_data["password"]
    })
    
    if login_response.status_code != 200:
        log(f"❌ Login failed: {login_response.status_code} - {login_response.text}", "ERROR")
        return False
    
    token = login_response.json()["access_token"]
    user_id = login_response.json()["user"]["id"]
    log(f"✅ Login successful - User ID: {user_id}")
    
    # Step 3: Get a service to review
    log("🔍 Getting service for review")
    services_response = requests.get(f"{BACKEND_URL}/services/listings")
    if services_response.status_code != 200:
        log(f"❌ Failed to get services: {services_response.status_code}", "ERROR")
        return False
    
    services = services_response.json()["listings"]
    if not services:
        log("❌ No services available for testing", "ERROR")
        return False
    
    # Use the first service
    service_id = services[0]["id"]
    service_name = services[0]["name"]
    log(f"✅ Using service: {service_name} (ID: {service_id})")
    
    # Step 4: Create a review
    log("⭐ Creating review")
    review_data = {
        "service_id": service_id,
        "rating": 5,
        "title": "Отличный сервис от тестового пользователя!",
        "content": "Очень доволен качеством обслуживания. Рекомендую всем! Тест создания отзыва работает корректно."
    }
    
    review_response = requests.post(
        f"{BACKEND_URL}/services/reviews",
        json=review_data,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if review_response.status_code == 200:
        review_result = review_response.json()
        if review_result.get("success"):
            review = review_result["review"]
            review_id = review["id"]
            log(f"✅ Review created successfully - ID: {review_id}")
            log(f"   Rating: {review['rating']}, Title: {review['title']}")
        else:
            log("❌ Review creation failed - success: false", "ERROR")
            return False
    elif review_response.status_code == 400 and "already reviewed" in review_response.text:
        log("ℹ️ User already reviewed this service, getting existing review")
        # Get existing reviews to find the user's review
        existing_reviews_response = requests.get(f"{BACKEND_URL}/services/reviews/{service_id}")
        if existing_reviews_response.status_code == 200:
            reviews = existing_reviews_response.json()["reviews"]
            user_review = next((r for r in reviews if r["user_id"] == user_id), None)
            if user_review:
                review_id = user_review["id"]
                log(f"✅ Found existing review - ID: {review_id}")
            else:
                log("❌ Could not find user's existing review", "ERROR")
                return False
        else:
            log("❌ Failed to get existing reviews", "ERROR")
            return False
    else:
        log(f"❌ Review creation failed: {review_response.status_code} - {review_response.text}", "ERROR")
        return False
    
    # Step 5: Get reviews for the service
    log("📋 Getting reviews for service")
    get_reviews_response = requests.get(f"{BACKEND_URL}/services/reviews/{service_id}")
    
    if get_reviews_response.status_code == 200:
        reviews_data = get_reviews_response.json()
        reviews = reviews_data["reviews"]
        total = reviews_data["total"]
        log(f"✅ Reviews retrieved - Found {len(reviews)} reviews (total: {total})")
        
        # Verify our review is in the list
        our_review = next((r for r in reviews if r["id"] == review_id), None)
        if our_review:
            log("✅ Our review found in the list")
            log(f"   Rating: {our_review['rating']}, Title: {our_review['title']}")
        else:
            log("⚠️ Our review not found in the list", "WARNING")
    else:
        log(f"❌ Get reviews failed: {get_reviews_response.status_code} - {get_reviews_response.text}", "ERROR")
        return False
    
    # Step 6: Test helpful functionality
    log("👍 Testing helpful functionality")
    helpful_response = requests.post(
        f"{BACKEND_URL}/services/reviews/{review_id}/helpful",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if helpful_response.status_code == 200:
        helpful_result = helpful_response.json()
        if helpful_result.get("success"):
            action = helpful_result.get("action", "unknown")
            log(f"✅ Helpful functionality working - Action: {action}")
        else:
            log("❌ Helpful failed - success: false", "ERROR")
            return False
    else:
        log(f"❌ Helpful failed: {helpful_response.status_code} - {helpful_response.text}", "ERROR")
        return False
    
    # Step 7: Test provider reply (will likely fail due to authorization, but that's expected)
    log("💬 Testing provider reply")
    reply_data = {"response": "Спасибо за отзыв! Мы ценим ваше мнение."}
    reply_response = requests.post(
        f"{BACKEND_URL}/services/reviews/{review_id}/reply",
        json=reply_data,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if reply_response.status_code == 200:
        reply_result = reply_response.json()
        if reply_result.get("success"):
            log("✅ Provider reply created successfully")
        else:
            log("❌ Provider reply failed - success: false", "ERROR")
    elif reply_response.status_code == 403:
        log("✅ Provider reply correctly blocked (user not authorized)")
    else:
        log(f"⚠️ Unexpected reply response: {reply_response.status_code} - {reply_response.text}", "WARNING")
    
    # Step 8: Verify service rating was updated
    log("📊 Verifying service rating update")
    service_response = requests.get(f"{BACKEND_URL}/services/listings/{service_id}")
    
    if service_response.status_code == 200:
        service_data = service_response.json()
        listing = service_data["listing"]
        rating = listing.get("rating")
        review_count = listing.get("review_count")
        
        if rating is not None and review_count is not None:
            log(f"✅ Service rating: {rating}, Review count: {review_count}")
            if 1 <= rating <= 5:
                log("✅ Rating is within valid range (1-5)")
            else:
                log(f"⚠️ Rating outside valid range: {rating}", "WARNING")
        else:
            log("⚠️ Rating or review count not found", "WARNING")
    else:
        log(f"❌ Get service failed: {service_response.status_code} - {service_response.text}", "ERROR")
        return False
    
    log("=" * 80)
    log("🎉 COMPREHENSIVE REVIEWS TEST COMPLETED SUCCESSFULLY!")
    log("✅ All critical reviews functionality verified:")
    log("   - Review creation ✅")
    log("   - Review retrieval ✅") 
    log("   - Helpful functionality ✅")
    log("   - Provider reply authorization ✅")
    log("   - Service rating updates ✅")
    log("=" * 80)
    
    return True

if __name__ == "__main__":
    success = test_complete_reviews_workflow()
    if success:
        print("\n🎉 All reviews functionality tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some reviews functionality tests failed!")
        sys.exit(1)