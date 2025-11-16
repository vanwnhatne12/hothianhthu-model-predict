const axios = require('axios');

async function testAPI() {
    try {
        const baseURL = 'http://localhost:3000';
        
        console.log('🧪 Testing VanNhatZzz AI Predictor API...\n');
        
        // Test health endpoint
        const health = await axios.get(`${baseURL}/api/health`);
        console.log('✅ Health Check:', health.data);
        
        // Test prediction endpoint
        const prediction = await axios.get(`${baseURL}/api/taixiu/predict`);
        console.log('✅ Prediction:', {
            predictVanNhat: prediction.data.predictVanNhat,
            confidence: prediction.data.confidence,
            session: prediction.data.session
        });
        
        // Test analysis endpoint
        const analysis = await axios.get(`${baseURL}/api/taixiu/analysis`);
        console.log('✅ Analysis:', {
            data_points: analysis.data.recent_history?.length,
            technical_analysis: !!analysis.data.technical_analysis
        });
        
        console.log('\n🎉 All tests passed! API is working correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testAPI();
