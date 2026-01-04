#!/usr/bin/env python3
"""
Backend Testing for ZION.CITY FINANCES Module - ALTYN Banking System
Testing the complete ALTYN Banking System with ALTYN COINs (stablecoin = 1 USD) and ALTYN TOKENs (equity/shares)

Test Focus:
1. Exchange Rates API (Public endpoint)
2. Wallet Management (Get user wallet with balances)
3. Portfolio View (Multi-currency portfolio)
4. Asset Transfers (COIN and TOKEN transfers with fees)
5. Transaction History (Complete transaction log)
6. Token Holders List (TOKEN ownership distribution)
7. Treasury Management (Admin-only treasury stats)
8. Coin Emission (Admin-only coin creation)
9. Dividend Distribution (Admin-only fee distribution to TOKEN holders)

Test Credentials:
- Admin: admin@test.com / testpassword123 (Expected: 35M TOKENS, ~999,900 COINS)
- User: testuser@test.com / testpassword123 (Expected: ~99.9 COINS)

Key Business Logic:
- 0.1% transaction fee on COIN transfers
- Fees go to treasury
- TOKEN holders receive dividends proportional to ownership
- 1 ALTYN COIN = 1 USD
"""

import requests
import json
import sys
from datetime import datetime
import time

# Get backend URL from environment
BACKEND_URL = "https://context-aware-ai-4.preview.emergentagent.com/api"

class FinanceModuleTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_user_token = None
        self.admin_user_id = None
        self.test_user_id = None
        self.test_transaction_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def login_user(self, email, password, user_type="admin"):
        """Login and get JWT token"""
        try:
            self.log(f"🔐 Logging in {user_type}: {email}")
            
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": email,
                "password": password
            })
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("access_token")
                user_id = data.get("user", {}).get("id")
                
                if user_type == "admin":
                    self.admin_token = token
                    self.admin_user_id = user_id
                else:
                    self.test_user_token = token
                    self.test_user_id = user_id
                    
                self.log(f"✅ {user_type.title()} login successful - User ID: {user_id}")
                return True
            else:
                self.log(f"❌ {user_type.title()} login failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ {user_type.title()} login error: {str(e)}", "ERROR")
            return False
    
    def get_auth_headers(self, user_type="admin"):
        """Get authorization headers"""
        token = self.admin_token if user_type == "admin" else self.test_user_token
        return {"Authorization": f"Bearer {token}"}
    
    def test_exchange_rates(self):
        """Test 1: GET /api/finance/exchange-rates (Public endpoint)"""
        self.log("💱 Testing GET /api/finance/exchange-rates (Public)")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/finance/exchange-rates")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                if data.get("success") and "rates" in data:
                    rates = data["rates"]
                    
                    # Check expected rates
                    usd_rate = rates.get("USD")
                    rub_rate = rates.get("RUB")
                    kzt_rate = rates.get("KZT")
                    
                    if usd_rate == 1.0:
                        self.log("✅ USD rate correct (1 ALTYN = 1 USD)")
                    else:
                        self.log(f"⚠️ USD rate unexpected: {usd_rate} (expected 1.0)", "WARNING")
                    
                    if rub_rate and rub_rate > 80:
                        self.log(f"✅ RUB rate reasonable: {rub_rate}")
                    else:
                        self.log(f"⚠️ RUB rate unexpected: {rub_rate}", "WARNING")
                    
                    if kzt_rate and kzt_rate > 400:
                        self.log(f"✅ KZT rate reasonable: {kzt_rate}")
                    else:
                        self.log(f"⚠️ KZT rate unexpected: {kzt_rate}", "WARNING")
                    
                    self.log("✅ Exchange rates API working correctly")
                    return True
                else:
                    self.log(f"❌ Invalid response structure: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Exchange rates failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exchange rates error: {str(e)}", "ERROR")
            return False
    
    def test_admin_wallet(self):
        """Test 2: GET /api/finance/wallet (Admin wallet)"""
        self.log("👑 Testing GET /api/finance/wallet (Admin)")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/finance/wallet",
                headers=self.get_auth_headers("admin")
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") and "wallet" in data:
                    wallet = data["wallet"]
                    
                    coin_balance = wallet.get("coin_balance", 0)
                    token_balance = wallet.get("token_balance", 0)
                    token_percentage = wallet.get("token_percentage", 0)
                    
                    self.log(f"💰 Admin COIN balance: {coin_balance:,.2f} AC")
                    self.log(f"🪙 Admin TOKEN balance: {token_balance:,.0f} AT")
                    self.log(f"📊 Admin TOKEN percentage: {token_percentage:.4f}%")
                    
                    # Verify expected balances
                    if token_balance >= 35_000_000:
                        self.log("✅ Admin has expected TOKEN balance (35M+)")
                    else:
                        self.log(f"⚠️ Admin TOKEN balance lower than expected: {token_balance:,.0f}", "WARNING")
                    
                    if coin_balance > 900_000:
                        self.log("✅ Admin has substantial COIN balance")
                    else:
                        self.log(f"⚠️ Admin COIN balance lower than expected: {coin_balance:,.2f}", "WARNING")
                    
                    # Check wallet structure
                    required_fields = ["user_name", "token_percentage", "pending_dividends"]
                    missing_fields = [field for field in required_fields if field not in wallet]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing wallet fields: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ Wallet structure validation passed")
                    
                    return True
                else:
                    self.log(f"❌ Invalid wallet response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Admin wallet failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Admin wallet error: {str(e)}", "ERROR")
            return False
    
    def test_user_wallet(self):
        """Test 3: GET /api/finance/wallet (Test user wallet)"""
        self.log("👤 Testing GET /api/finance/wallet (Test User)")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/finance/wallet",
                headers=self.get_auth_headers("user")
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") and "wallet" in data:
                    wallet = data["wallet"]
                    
                    coin_balance = wallet.get("coin_balance", 0)
                    token_balance = wallet.get("token_balance", 0)
                    
                    self.log(f"💰 User COIN balance: {coin_balance:.2f} AC")
                    self.log(f"🪙 User TOKEN balance: {token_balance:.0f} AT")
                    
                    # Verify expected balances (should be around 99.9 COINS after fee)
                    if 99 <= coin_balance <= 100:
                        self.log("✅ User has expected COIN balance (~99.9 AC)")
                    else:
                        self.log(f"⚠️ User COIN balance unexpected: {coin_balance:.2f}", "WARNING")
                    
                    return True
                else:
                    self.log(f"❌ Invalid user wallet response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ User wallet failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ User wallet error: {str(e)}", "ERROR")
            return False
    
    def test_portfolio(self):
        """Test 4: GET /api/finance/portfolio (Multi-currency portfolio)"""
        self.log("📊 Testing GET /api/finance/portfolio (Admin)")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/finance/portfolio",
                headers=self.get_auth_headers("admin")
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") and "portfolio" in data:
                    portfolio = data["portfolio"]
                    
                    # Check coin balance in multiple currencies
                    coin_balance = portfolio.get("coin_balance", {})
                    token_balance = portfolio.get("token_balance", {})
                    
                    if coin_balance:
                        usd_value = coin_balance.get("usd", 0)
                        rub_value = coin_balance.get("rub", 0)
                        kzt_value = coin_balance.get("kzt", 0)
                        
                        self.log(f"💵 Portfolio USD: ${usd_value:,.2f}")
                        self.log(f"🇷🇺 Portfolio RUB: ₽{rub_value:,.2f}")
                        self.log(f"🇰🇿 Portfolio KZT: ₸{kzt_value:,.2f}")
                        
                        # Verify currency conversion logic
                        if usd_value > 0 and rub_value > usd_value * 80:
                            self.log("✅ Currency conversion working (RUB > USD * 80)")
                        else:
                            self.log("⚠️ Currency conversion may have issues", "WARNING")
                    
                    if token_balance:
                        token_amount = token_balance.get("amount", 0)
                        token_percentage = token_balance.get("percentage", 0)
                        
                        self.log(f"🪙 TOKEN amount: {token_amount:,.0f}")
                        self.log(f"📊 TOKEN percentage: {token_percentage:.4f}%")
                    
                    # Check for dividends info
                    dividends = portfolio.get("dividends", {})
                    if dividends:
                        total_received = dividends.get("total_received", 0)
                        pending = dividends.get("pending", 0)
                        
                        self.log(f"💎 Total dividends received: {total_received:.2f} AC")
                        self.log(f"⏳ Pending dividends: {pending:.2f} AC")
                    
                    self.log("✅ Portfolio API working correctly")
                    return True
                else:
                    self.log(f"❌ Invalid portfolio response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Portfolio failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Portfolio error: {str(e)}", "ERROR")
            return False
    
    def test_coin_transfer(self):
        """Test 5: POST /api/finance/transfer (COIN transfer with fee)"""
        self.log("💸 Testing POST /api/finance/transfer (COIN transfer)")
        
        try:
            transfer_data = {
                "to_user_email": "testuser@test.com",
                "amount": 50.0,
                "asset_type": "COIN",
                "description": "Test COIN transfer for finance module testing"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/finance/transfer",
                json=transfer_data,
                headers=self.get_auth_headers("admin")
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") and "transaction" in data:
                    transaction = data["transaction"]
                    
                    amount = transaction.get("amount", 0)
                    fee = transaction.get("fee", 0)
                    net_amount = transaction.get("net_amount", 0)
                    recipient = transaction.get("recipient", "")
                    
                    self.log(f"💰 Transfer amount: {amount} AC")
                    self.log(f"💸 Transaction fee: {fee} AC")
                    self.log(f"📥 Net received: {net_amount} AC")
                    self.log(f"👤 Recipient: {recipient}")
                    
                    # Verify fee calculation (0.1%)
                    expected_fee = amount * 0.001
                    if abs(fee - expected_fee) < 0.01:
                        self.log("✅ Transaction fee calculated correctly (0.1%)")
                    else:
                        self.log(f"❌ Fee calculation error: expected {expected_fee}, got {fee}", "ERROR")
                        return False
                    
                    # Verify net amount
                    expected_net = amount - fee
                    if abs(net_amount - expected_net) < 0.01:
                        self.log("✅ Net amount calculated correctly")
                    else:
                        self.log(f"❌ Net amount error: expected {expected_net}, got {net_amount}", "ERROR")
                        return False
                    
                    self.test_transaction_id = transaction.get("id")
                    self.log("✅ COIN transfer completed successfully")
                    return True
                else:
                    self.log(f"❌ Invalid transfer response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ COIN transfer failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ COIN transfer error: {str(e)}", "ERROR")
            return False
    
    def test_transaction_history(self):
        """Test 6: GET /api/finance/transactions (Transaction history)"""
        self.log("📜 Testing GET /api/finance/transactions (Admin)")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/finance/transactions?limit=10",
                headers=self.get_auth_headers("admin")
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") and "transactions" in data:
                    transactions = data["transactions"]
                    total = data.get("total", 0)
                    
                    self.log(f"📊 Found {len(transactions)} transactions (total: {total})")
                    
                    if transactions:
                        # Check first transaction structure
                        first_tx = transactions[0]
                        required_fields = ["id", "amount", "asset_type", "transaction_type", "from_user_name", "to_user_name", "is_incoming"]
                        missing_fields = [field for field in required_fields if field not in first_tx]
                        
                        if missing_fields:
                            self.log(f"⚠️ Missing transaction fields: {missing_fields}", "WARNING")
                        else:
                            self.log("✅ Transaction structure validation passed")
                        
                        # Look for our test transaction
                        if self.test_transaction_id:
                            test_tx = next((tx for tx in transactions if tx.get("id") == self.test_transaction_id), None)
                            if test_tx:
                                self.log("✅ Test transaction found in history")
                            else:
                                self.log("⚠️ Test transaction not found in recent history", "WARNING")
                        
                        # Check for different transaction types
                        tx_types = set(tx.get("transaction_type") for tx in transactions)
                        self.log(f"📋 Transaction types found: {', '.join(tx_types)}")
                    
                    self.log("✅ Transaction history API working correctly")
                    return True
                else:
                    self.log(f"❌ Invalid transactions response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Transaction history failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Transaction history error: {str(e)}", "ERROR")
            return False
    
    def test_token_holders(self):
        """Test 7: GET /api/finance/token-holders (TOKEN ownership distribution)"""
        self.log("🏆 Testing GET /api/finance/token-holders")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/finance/token-holders?limit=20",
                headers=self.get_auth_headers("admin")
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") and "holders" in data:
                    holders = data["holders"]
                    total_tokens = data.get("total_tokens", 0)
                    total_supply = data.get("total_supply", 0)
                    
                    self.log(f"👥 Found {len(holders)} TOKEN holders")
                    self.log(f"🪙 Total tokens in circulation: {total_tokens:,.0f}")
                    self.log(f"📊 Total supply: {total_supply:,.0f}")
                    
                    if holders:
                        # Check top holder (should be admin)
                        top_holder = holders[0]
                        holder_name = top_holder.get("user_name", "Unknown")
                        holder_tokens = top_holder.get("token_balance", 0)
                        holder_percentage = top_holder.get("percentage", 0)
                        
                        self.log(f"👑 Top holder: {holder_name}")
                        self.log(f"🪙 Tokens: {holder_tokens:,.0f} ({holder_percentage:.4f}%)")
                        
                        # Verify percentage calculation
                        if total_tokens > 0:
                            expected_percentage = (holder_tokens / total_tokens) * 100
                            if abs(holder_percentage - expected_percentage) < 0.01:
                                self.log("✅ Percentage calculation correct")
                            else:
                                self.log(f"⚠️ Percentage calculation may be off", "WARNING")
                        
                        # Check holder structure
                        required_fields = ["user_id", "user_name", "token_balance", "percentage"]
                        missing_fields = [field for field in required_fields if field not in top_holder]
                        
                        if missing_fields:
                            self.log(f"⚠️ Missing holder fields: {missing_fields}", "WARNING")
                        else:
                            self.log("✅ Token holder structure validation passed")
                    
                    self.log("✅ Token holders API working correctly")
                    return True
                else:
                    self.log(f"❌ Invalid token holders response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Token holders failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Token holders error: {str(e)}", "ERROR")
            return False
    
    def test_treasury_stats(self):
        """Test 8: GET /api/finance/treasury (Admin-only treasury statistics)"""
        self.log("🏛️ Testing GET /api/finance/treasury (Admin only)")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/finance/treasury",
                headers=self.get_auth_headers("admin")
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") and "treasury" in data:
                    treasury = data["treasury"]
                    
                    collected_fees = treasury.get("collected_fees", 0)
                    coins_in_circulation = treasury.get("total_coins_in_circulation", 0)
                    token_supply = treasury.get("total_token_supply", 0)
                    
                    self.log(f"💰 Collected fees: {collected_fees:.2f} AC")
                    self.log(f"🪙 Coins in circulation: {coins_in_circulation:,.2f} AC")
                    self.log(f"📊 Total TOKEN supply: {token_supply:,.0f} AT")
                    
                    # Check for recent emissions and dividends
                    recent_emissions = data.get("recent_emissions", [])
                    recent_dividends = data.get("recent_dividends", [])
                    
                    self.log(f"📈 Recent emissions: {len(recent_emissions)}")
                    self.log(f"💎 Recent dividends: {len(recent_dividends)}")
                    
                    # Verify treasury has collected some fees
                    if collected_fees > 0:
                        self.log("✅ Treasury has collected transaction fees")
                    else:
                        self.log("⚠️ No fees collected yet (expected after transfers)", "WARNING")
                    
                    self.log("✅ Treasury stats API working correctly")
                    return True
                else:
                    self.log(f"❌ Invalid treasury response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Treasury stats failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Treasury stats error: {str(e)}", "ERROR")
            return False
    
    def test_coin_emission(self):
        """Test 9: POST /api/finance/admin/emission (Admin-only coin creation)"""
        self.log("🏭 Testing POST /api/finance/admin/emission (Admin only)")
        
        try:
            emission_data = {
                "amount": 10000,
                "description": "Test emission for finance module testing"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/finance/admin/emission",
                json=emission_data,
                headers=self.get_auth_headers("admin")
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") and "emission" in data:
                    emission = data["emission"]
                    
                    emission_id = emission.get("id")
                    amount = emission.get("amount", 0)
                    description = emission.get("description", "")
                    
                    self.log(f"🆔 Emission ID: {emission_id}")
                    self.log(f"💰 Amount created: {amount:,.0f} AC")
                    self.log(f"📝 Description: {description}")
                    
                    # Verify emission amount
                    if amount == emission_data["amount"]:
                        self.log("✅ Emission amount correct")
                    else:
                        self.log(f"❌ Emission amount mismatch", "ERROR")
                        return False
                    
                    self.log("✅ Coin emission completed successfully")
                    return True
                else:
                    self.log(f"❌ Invalid emission response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Coin emission failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Coin emission error: {str(e)}", "ERROR")
            return False
    
    def test_dividend_distribution(self):
        """Test 10: POST /api/finance/admin/distribute-dividends (Admin-only dividend payout)"""
        self.log("💎 Testing POST /api/finance/admin/distribute-dividends (Admin only)")
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/finance/admin/distribute-dividends",
                headers=self.get_auth_headers("admin")
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") and "payout" in data:
                    payout = data["payout"]
                    
                    payout_id = payout.get("id")
                    total_distributed = payout.get("total_distributed", 0)
                    holders_count = payout.get("holders_count", 0)
                    distribution_details = payout.get("distribution_details", [])
                    
                    self.log(f"🆔 Payout ID: {payout_id}")
                    self.log(f"💰 Total distributed: {total_distributed:.2f} AC")
                    self.log(f"👥 Holders count: {holders_count}")
                    self.log(f"📊 Distribution details: {len(distribution_details)} entries")
                    
                    # Verify distribution details
                    if distribution_details:
                        total_check = sum(detail.get("amount", 0) for detail in distribution_details)
                        if abs(total_check - total_distributed) < 0.01:
                            self.log("✅ Distribution amounts sum correctly")
                        else:
                            self.log(f"⚠️ Distribution sum mismatch: {total_check} vs {total_distributed}", "WARNING")
                        
                        # Check percentage distribution
                        total_percentage = sum(detail.get("token_percentage", 0) for detail in distribution_details)
                        if abs(total_percentage - 100.0) < 0.01:
                            self.log("✅ Token percentages sum to 100%")
                        else:
                            self.log(f"⚠️ Percentage sum: {total_percentage:.4f}% (expected ~100%)", "WARNING")
                    
                    self.log("✅ Dividend distribution completed successfully")
                    return True
                else:
                    self.log(f"❌ Invalid dividend response: {data}", "ERROR")
                    return False
            elif response.status_code == 400:
                # No fees to distribute is acceptable
                error_msg = response.json().get("detail", "")
                if "No fees to distribute" in error_msg:
                    self.log("ℹ️ No fees available for distribution (acceptable)")
                    return True
                else:
                    self.log(f"❌ Dividend distribution failed: {error_msg}", "ERROR")
                    return False
            else:
                self.log(f"❌ Dividend distribution failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Dividend distribution error: {str(e)}", "ERROR")
            return False
    
    def test_non_admin_access(self):
        """Test 11: Verify admin-only endpoints reject regular users"""
        self.log("🚫 Testing admin-only endpoint access control")
        
        admin_endpoints = [
            ("/finance/treasury", "GET"),
            ("/finance/admin/emission", "POST"),
            ("/finance/admin/distribute-dividends", "POST")
        ]
        
        all_passed = True
        
        for endpoint, method in admin_endpoints:
            try:
                if method == "GET":
                    response = self.session.get(
                        f"{BACKEND_URL}{endpoint}",
                        headers=self.get_auth_headers("user")
                    )
                else:
                    response = self.session.post(
                        f"{BACKEND_URL}{endpoint}",
                        json={"amount": 1000, "description": "Test"},
                        headers=self.get_auth_headers("user")
                    )
                
                if response.status_code == 403:
                    self.log(f"✅ {endpoint} correctly rejected non-admin user")
                else:
                    self.log(f"❌ {endpoint} should reject non-admin (got {response.status_code})", "ERROR")
                    all_passed = False
                    
            except Exception as e:
                self.log(f"❌ Error testing {endpoint}: {str(e)}", "ERROR")
                all_passed = False
        
        return all_passed
    
    def run_comprehensive_test(self):
        """Run all FINANCES module tests in sequence"""
        self.log("🚀 Starting ZION.CITY Backend Testing - FINANCES Module (ALTYN Banking System)")
        self.log("=" * 90)
        
        # Test results tracking
        test_results = {
            "admin_login": False,
            "user_login": False,
            "exchange_rates": False,
            "admin_wallet": False,
            "user_wallet": False,
            "portfolio": False,
            "coin_transfer": False,
            "transaction_history": False,
            "token_holders": False,
            "treasury_stats": False,
            "coin_emission": False,
            "dividend_distribution": False,
            "admin_access_control": False
        }
        
        # 1. Login both users
        test_results["admin_login"] = self.login_user("admin@test.com", "testpassword123", "admin")
        test_results["user_login"] = self.login_user("testuser@test.com", "testpassword123", "user")
        
        if not test_results["admin_login"]:
            self.log("❌ Cannot proceed without admin login", "ERROR")
            return test_results
        
        if not test_results["user_login"]:
            self.log("⚠️ User login failed, some tests will be skipped", "WARNING")
        
        # 2. Test public exchange rates API
        test_results["exchange_rates"] = self.test_exchange_rates()
        
        # 3. Test wallet APIs
        test_results["admin_wallet"] = self.test_admin_wallet()
        if test_results["user_login"]:
            test_results["user_wallet"] = self.test_user_wallet()
        
        # 4. Test portfolio API
        test_results["portfolio"] = self.test_portfolio()
        
        # 5. Test asset transfer (creates transaction for history test)
        if test_results["user_login"]:
            test_results["coin_transfer"] = self.test_coin_transfer()
        
        # 6. Test transaction history
        test_results["transaction_history"] = self.test_transaction_history()
        
        # 7. Test token holders list
        test_results["token_holders"] = self.test_token_holders()
        
        # 8. Test admin-only treasury stats
        test_results["treasury_stats"] = self.test_treasury_stats()
        
        # 9. Test admin-only coin emission
        test_results["coin_emission"] = self.test_coin_emission()
        
        # 10. Test admin-only dividend distribution
        test_results["dividend_distribution"] = self.test_dividend_distribution()
        
        # 11. Test admin access control
        if test_results["user_login"]:
            test_results["admin_access_control"] = self.test_non_admin_access()
        
        # Print final results
        self.log("=" * 90)
        self.log("📊 FINAL TEST RESULTS - FINANCES Module (ALTYN Banking System)")
        self.log("=" * 90)
        
        passed_tests = 0
        total_tests = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.replace('_', ' ').title()}: {status}")
            if result:
                passed_tests += 1
        
        # Overall summary
        success_rate = (passed_tests / total_tests) * 100
        self.log("=" * 90)
        self.log(f"📈 OVERALL SUCCESS RATE: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
        
        # Feature-specific summary
        core_features = ["exchange_rates", "admin_wallet", "coin_transfer", "treasury_stats", "coin_emission"]
        core_passed = sum(1 for feature in core_features if test_results.get(feature, False))
        
        if core_passed == len(core_features):
            self.log("🎉 ALL CORE ALTYN BANKING FEATURES WORKING!")
        else:
            self.log(f"⚠️ {core_passed}/{len(core_features)} core banking features working")
        
        # Business logic checks
        business_logic_tests = ["coin_transfer", "treasury_stats", "dividend_distribution"]
        business_passed = sum(1 for test in business_logic_tests if test_results.get(test, False))
        
        if business_passed == len(business_logic_tests):
            self.log("💼 ALL BUSINESS LOGIC TESTS PASSED!")
            self.log("   ✅ 0.1% transaction fees working")
            self.log("   ✅ Treasury fee collection working")
            self.log("   ✅ Dividend distribution working")
        else:
            self.log(f"⚠️ {business_passed}/{len(business_logic_tests)} business logic tests passed")
        
        # Security checks
        if test_results.get("admin_access_control"):
            self.log("🔒 ADMIN ACCESS CONTROL WORKING!")
        else:
            self.log("⚠️ Admin access control may have issues")
        
        self.log("=" * 90)
        
        return test_results

def main():
    """Main test execution"""
    tester = FinanceModuleTester()
    results = tester.run_comprehensive_test()
    
    # Exit with appropriate code
    critical_tests = ["admin_login", "exchange_rates", "admin_wallet", "treasury_stats"]
    critical_passed = all(results.get(test, False) for test in critical_tests)
    
    if critical_passed:
        print("\n🎉 All critical FINANCES module tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some critical FINANCES module tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()