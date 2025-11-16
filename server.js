const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const cron = require('node-cron');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const CONFIG = {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "sk-5bae7cb92194432d88a6117675f474ae",
    HISTORY_API_URL: "https://sunwinsaygex-8616.onrender.com/api/taixiu/history",
    DEEPSEEK_API_URL: "https://api.deepseek.com/v1/chat/completions",
    CACHE_DURATION: 60000, // 1 phút
    MAX_HISTORY: 50
};

// Cache system
let predictionCache = {
    data: null,
    timestamp: null,
    historyData: null,
    historyTimestamp: null
};

class AdvancedTaiXiuPredictor {
    constructor() {
        this.config = CONFIG;
    }

    async fetchHistoryData() {
        // Kiểm tra cache
        if (predictionCache.historyData && 
            predictionCache.historyTimestamp && 
            (Date.now() - predictionCache.historyTimestamp) < this.config.CACHE_DURATION) {
            return predictionCache.historyData;
        }

        try {
            const response = await axios.get(this.config.HISTORY_API_URL, {
                timeout: 10000
            });
            
            const historyData = response.data;
            
            // Lưu cache
            predictionCache.historyData = historyData;
            predictionCache.historyTimestamp = Date.now();
            
            console.log(`✅ Lấy thành công ${historyData.length} bản ghi lịch sử`);
            return historyData;
        } catch (error) {
            console.error('❌ Lỗi khi lấy dữ liệu lịch sử:', error.message);
            return predictionCache.historyData || [];
        }
    }

    analyzePatterns(historyData) {
        if (!historyData || historyData.length < 5) {
            return { error: "Không đủ dữ liệu để phân tích" };
        }

        // Chuẩn bị dữ liệu
        const recentData = historyData.slice(-20);
        const results = recentData.map(item => item.resultVanNhat?.toUpperCase() || '');
        const totals = recentData.map(item => item.total || 0);

        // Phân tích cơ bản
        const taiCount = results.filter(r => r === 'TÀI').length;
        const xiuCount = results.filter(r => r === 'XỈU').length;
        const totalGames = results.length;

        // Phân tích nâng cao
        const recentTrend = this.calculateRecentTrend(results.slice(-10));
        const sequenceAnalysis = this.analyzeSequences(results);
        const statisticalAnalysis = this.statisticalAnalysis(totals);
        const probabilityAnalysis = this.probabilityAnalysis(historyData);

        return {
            tai_ratio: taiCount / totalGames,
            xiu_ratio: xiuCount / totalGames,
            recent_trend: recentTrend,
            sequences: sequenceAnalysis,
            statistics: statisticalAnalysis,
            probabilities: probabilityAnalysis,
            total_games: totalGames,
            analysis_timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
    }

    calculateRecentTrend(recentResults) {
        if (!recentResults.length) return { trend: "unknown", strength: 0 };

        const taiCount = recentResults.filter(r => r === 'TÀI').length;
        const xiuCount = recentResults.filter(r => r === 'XỈU').length;

        if (taiCount > xiuCount) {
            return {
                trend: "TÀI",
                strength: (taiCount - xiuCount) / recentResults.length,
                details: `Tài chiếm ưu thế ${taiCount}/${recentResults.length} lượt gần đây`
            };
        } else if (xiuCount > taiCount) {
            return {
                trend: "XỈU",
                strength: (xiuCount - taiCount) / recentResults.length,
                details: `Xỉu chiếm ưu thế ${xiuCount}/${recentResults.length} lượt gần đây`
            };
        } else {
            return {
                trend: "CÂN BẰNG",
                strength: 0,
                details: "Tài Xỉu đang cân bằng"
            };
        }
    }

    analyzeSequences(results) {
        const sequences = {
            current_streak: 1,
            current_type: results[0] || '',
            max_tai_streak: 0,
            max_xiu_streak: 0,
            alternating_patterns: 0,
            streak_history: []
        };

        let currentStreak = 1;
        let currentType = results[0] || '';

        for (let i = 1; i < results.length; i++) {
            if (results[i] === results[i - 1]) {
                currentStreak++;
            } else {
                // Lưu streak cũ
                if (currentType === 'TÀI') {
                    sequences.max_tai_streak = Math.max(sequences.max_tai_streak, currentStreak);
                } else if (currentType === 'XỈU') {
                    sequences.max_xiu_streak = Math.max(sequences.max_xiu_streak, currentStreak);
                }
                
                sequences.streak_history.push({
                    type: currentType,
                    length: currentStreak
                });

                // Bắt đầu streak mới
                currentStreak = 1;
                currentType = results[i];
            }

            // Đếm mẫu xen kẽ
            if (i >= 2 && results[i] !== results[i - 1] && results[i - 1] !== results[i - 2]) {
                sequences.alternating_patterns++;
            }
        }

        // Cập nhật streak hiện tại
        sequences.current_streak = currentStreak;
        sequences.current_type = currentType;

        if (currentType === 'TÀI') {
            sequences.max_tai_streak = Math.max(sequences.max_tai_streak, currentStreak);
        } else if (currentType === 'XỈU') {
            sequences.max_xiu_streak = Math.max(sequences.max_xiu_streak, currentStreak);
        }

        return sequences;
    }

    statisticalAnalysis(totals) {
        if (!totals.length) return {};

        const stats = {
            mean: totals.reduce((a, b) => a + b, 0) / totals.length,
            min: Math.min(...totals),
            max: Math.max(...totals),
            tai_count: totals.filter(t => t >= 11).length,
            xiu_count: totals.filter(t => t <= 10).length,
            total_count: totals.length
        };

        // Tính độ lệch chuẩn
        const squareDiffs = totals.map(value => {
            const diff = value - stats.mean;
            return diff * diff;
        });
        stats.std_dev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / totals.length);

        // Phân tích phân phối
        stats.distribution = this.analyzeDistribution(totals);
        stats.variance = stats.std_dev * stats.std_dev;

        return stats;
    }

    analyzeDistribution(totals) {
        const distribution = {
            3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0,
            11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0, 17: 0, 18: 0
        };

        totals.forEach(total => {
            if (distribution[total] !== undefined) {
                distribution[total]++;
            }
        });

        return distribution;
    }

    probabilityAnalysis(historyData) {
        const recentData = historyData.slice(-30);
        const patterns = {
            after_tai: { tai: 0, xiu: 0 },
            after_xiu: { tai: 0, xiu: 0 },
            after_streak: { break: 0, continue: 0 }
        };

        for (let i = 1; i < recentData.length; i++) {
            const prev = recentData[i - 1].resultVanNhat?.toUpperCase();
            const current = recentData[i].resultVanNhat?.toUpperCase();

            if (prev === 'TÀI') {
                patterns.after_tai[current === 'TÀI' ? 'tai' : 'xiu']++;
            } else if (prev === 'XỈU') {
                patterns.after_xiu[current === 'TÀI' ? 'tai' : 'xiu']++;
            }

            // Phân tích streak
            if (i >= 2) {
                const prev2 = recentData[i - 2].resultVanNhat?.toUpperCase();
                if (prev === prev2 && prev === current) {
                    patterns.after_streak.continue++;
                } else if (prev === prev2 && prev !== current) {
                    patterns.after_streak.break++;
                }
            }
        }

        // Tính xác suất
        const probabilities = {
            after_tai_tai: patterns.after_tai.tai + patterns.after_tai.xiu > 0 ? 
                patterns.after_tai.tai / (patterns.after_tai.tai + patterns.after_tai.xiu) : 0.5,
            after_tai_xiu: patterns.after_tai.tai + patterns.after_tai.xiu > 0 ? 
                patterns.after_tai.xiu / (patterns.after_tai.tai + patterns.after_tai.xiu) : 0.5,
            after_xiu_tai: patterns.after_xiu.tai + patterns.after_xiu.xiu > 0 ? 
                patterns.after_xiu.tai / (patterns.after_xiu.tai + patterns.after_xiu.xiu) : 0.5,
            after_xiu_xiu: patterns.after_xiu.tai + patterns.after_xiu.xiu > 0 ? 
                patterns.after_xiu.xiu / (patterns.after_xiu.tai + patterns.after_xiu.xiu) : 0.5,
            streak_break: patterns.after_streak.break + patterns.after_streak.continue > 0 ?
                patterns.after_streak.break / (patterns.after_streak.break + patterns.after_streak.continue) : 0.3
        };

        return probabilities;
    }

    calculateInitialPrediction(analysis) {
        if (analysis.error) {
            return { prediction: "TÀI", confidence: 0.5, reason: "Dự đoán mặc định do thiếu dữ liệu" };
        }

        // Trọng số đa yếu tố
        const weights = {
            trend: 0.25,
            sequence: 0.20,
            statistics: 0.25,
            probability: 0.20,
            ratio: 0.10
        };

        let taiScore = 0;
        let xiuScore = 0;
        let reasons = [];

        // 1. Phân tích xu hướng
        const trend = analysis.recent_trend;
        if (trend.trend === 'TÀI') {
            taiScore += weights.trend * (0.6 + trend.strength);
            xiuScore += weights.trend * (0.4 - trend.strength);
            reasons.push(`📈 Xu hướng nghiêng Tài (${trend.details})`);
        } else if (trend.trend === 'XỈU') {
            taiScore += weights.trend * (0.4 - trend.strength);
            xiuScore += weights.trend * (0.6 + trend.strength);
            reasons.push(`📉 Xu hướng nghiêng Xỉu (${trend.details})`);
        } else {
            taiScore += weights.trend * 0.5;
            xiuScore += weights.trend * 0.5;
            reasons.push(`⚖️ Xu hướng cân bằng`);
        }

        // 2. Phân tích chuỗi
        const sequences = analysis.sequences;
        if (sequences.current_type === 'TÀI' && sequences.current_streak >= 3) {
            // Xu hướng đảo chiều sau chuỗi dài
            xiuScore += weights.sequence * 0.7;
            taiScore += weights.sequence * 0.3;
            reasons.push(`🔄 Chuỗi Tài ${sequences.current_streak} - Dự báo đảo chiều`);
        } else if (sequences.current_type === 'XỈU' && sequences.current_streak >= 3) {
            taiScore += weights.sequence * 0.7;
            xiuScore += weights.sequence * 0.3;
            reasons.push(`🔄 Chuỗi Xỉu ${sequences.current_streak} - Dự báo đảo chiều`);
        } else {
            taiScore += weights.sequence * 0.5;
            xiuScore += weights.sequence * 0.5;
            reasons.push(`📊 Chuỗi hiện tại: ${sequences.current_type} ${sequences.current_streak}`);
        }

        // 3. Phân tích thống kê
        const stats = analysis.statistics;
        if (stats.mean > 10.8) {
            taiScore += weights.statistics * 0.7;
            xiuScore += weights.statistics * 0.3;
            reasons.push(`🎯 Điểm trung bình cao (${stats.mean.toFixed(2)}) - Nghiêng Tài`);
        } else if (stats.mean < 10.2) {
            taiScore += weights.statistics * 0.3;
            xiuScore += weights.statistics * 0.7;
            reasons.push(`🎯 Điểm trung bình thấp (${stats.mean.toFixed(2)}) - Nghiêng Xỉu`);
        } else {
            taiScore += weights.statistics * 0.5;
            xiuScore += weights.statistics * 0.5;
            reasons.push(`🎯 Điểm trung bình cân bằng (${stats.mean.toFixed(2)})`);
        }

        // 4. Phân tích xác suất
        const probabilities = analysis.probabilities;
        const lastResult = analysis.sequences.current_type;
        
        if (lastResult === 'TÀI') {
            taiScore += weights.probability * probabilities.after_tai_tai;
            xiuScore += weights.probability * probabilities.after_tai_xiu;
            reasons.push(`🎲 Xác suất sau Tài: Tài ${(probabilities.after_tai_tai * 100).toFixed(1)}% - Xỉu ${(probabilities.after_tai_xiu * 100).toFixed(1)}%`);
        } else if (lastResult === 'XỈU') {
            taiScore += weights.probability * probabilities.after_xiu_tai;
            xiuScore += weights.probability * probabilities.after_xiu_xiu;
            reasons.push(`🎲 Xác suất sau Xỉu: Tài ${(probabilities.after_xiu_tai * 100).toFixed(1)}% - Xỉu ${(probabilities.after_xiu_xiu * 100).toFixed(1)}%`);
        }

        // 5. Tỷ lệ lịch sử
        taiScore += weights.ratio * analysis.tai_ratio;
        xiuScore += weights.ratio * analysis.xiu_ratio;
        reasons.push(`📊 Tỷ lệ lịch sử: Tài ${(analysis.tai_ratio * 100).toFixed(1)}% - Xỉu ${(analysis.xiu_ratio * 100).toFixed(1)}%`);

        // Tính toán kết quả
        const totalScore = taiScore + xiuScore;
        const taiProbability = totalScore > 0 ? taiScore / totalScore : 0.5;
        const xiuProbability = totalScore > 0 ? xiuScore / totalScore : 0.5;

        let prediction, confidence;
        if (taiProbability > xiuProbability) {
            prediction = "TÀI";
            confidence = taiProbability;
        } else {
            prediction = "XỈU";
            confidence = xiuProbability;
        }

        return {
            prediction,
            confidence,
            tai_probability: taiProbability,
            xiu_probability: xiuProbability,
            reasons,
            algorithm_details: {
                tai_score: taiScore,
                xiu_score: xiuScore,
                weights_applied: weights
            }
        };
    }

    async getAIAnalysis(historyData, initialPrediction, algoConfidence, algorithmAnalysis) {
        const analysisData = this.analyzePatterns(historyData);

        const prompt = `
        PHÂN TÍCH DỰ ĐOÁN TÀI XỈU CHUYÊN SÂU - VANNHATZZZ AI

        🎯 DỮ LIỆU LỊCH SỬ PHÂN TÍCH:
        ${JSON.stringify(historyData.slice(-15), null, 2)}

        📊 PHÂN TÍCH KỸ THUẬT TỪ THUẬT TOÁN:
        - Tỷ lệ Tài/Xỉu lịch sử: ${(analysisData.tai_ratio * 100).toFixed(1)}% / ${(analysisData.xiu_ratio * 100).toFixed(1)}%
        - Xu hướng gần đây: ${analysisData.recent_trend.details}
        - Chuỗi hiện tại: ${analysisData.sequences.current_type} (${analysisData.sequences.current_streak} lượt)
        - Điểm trung bình: ${analysisData.statistics.mean?.toFixed(2) || 'N/A'}
        - Phân phối điểm: ${JSON.stringify(analysisData.statistics.distribution)}

        🔍 PHÂN TÍCH XÁC SUẤT NÂNG CAO:
        ${JSON.stringify(analysisData.probabilities, null, 2)}

        🤖 DỰ ĐOÁN TỪ THUẬT TOÁN:
        - Kết quả: ${initialPrediction}
        - Độ tin cậy: ${(algoConfidence * 100).toFixed(1)}%
        - Lý do: ${algorithmAnalysis.reasons.join(' | ')}

        🧠 HÃY PHÂN TÍCH CHUYÊN SÂU VÀ ĐƯA RA DỰ ĐOÁN CUỐI CÙNG:

        1. Đánh giá xu hướng tổng thể
        2. Phân tích mẫu hình chuỗi và khả năng đảo chiều
        3. Đánh giá xác suất thống kê
        4. Dự đoán kết quả tiếp theo với lý do chi tiết
        5. Độ tin cậy (cao/trung_bình/thấp)

        📝 ĐỊNH DẠNG KẾT QUẢ JSON:
        {
            "predictVanNhat": "TÀI/XỈU",
            "confidence": "cao/trung_bình/thấp",
            "giai_thich": "Giải thích chi tiết dựa trên phân tích đa yếu tố...",
            "phan_tich_chuyen_sau": "Phân tích chuyên sâu về xu hướng, xác suất...",
            "luu_y": "Cảnh báo rủi ro và lưu ý quan trọng...",
            "yeu_to_quyet_dinh": ["yếu tố 1", "yếu tố 2", ...]
        }

        ⚠️ LƯU Ý: Luôn trả về JSON hợp lệ, phân tích khách quan dựa trên dữ liệu.
        `;

        try {
            const response = await axios.post(this.config.DEEPSEEK_API_URL, {
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "Bạn là chuyên gia phân tích xác suất Tài Xỉu chuyên nghiệp. Phân tích khách quan dữ liệu và đưa ra dự đoán có cơ sở khoa học. LUÔN trả về JSON hợp lệ."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.DEEPSEEK_API_KEY}`
                },
                timeout: 30000
            });

            const aiResponse = response.data.choices[0].message.content;
            return this.parseAIResponse(aiResponse, initialPrediction, algoConfidence);

        } catch (error) {
            console.error('❌ Lỗi AI Analysis:', error.message);
            return this.getFallbackResponse(initialPrediction, algoConfidence, algorithmAnalysis);
        }
    }

    parseAIResponse(aiText, initialPred, algoConfidence) {
        // Mặc định fallback
        const fallback = {
            predictVanNhat: initialPred,
            confidence: algoConfidence > 0.7 ? "cao" : algoConfidence > 0.6 ? "trung_bình" : "thấp",
            giai_thich: `Dự đoán dựa trên thuật toán với độ tin cậy ${(algoConfidence * 100).toFixed(1)}%`,
            phan_tich_chuyen_sau: "Phân tích AI tạm thời không khả dụng. Sử dụng kết quả từ thuật toán nâng cao.",
            luu_y: "Kết quả dự đoán chỉ mang tính chất tham khảo. Chơi cờ bạc có thể gây nghiện và mất tiền.",
            yeu_to_quyet_dinh: ["Phân tích thuật toán", "Dữ liệu lịch sử", "Xu hướng thống kê"]
        };

        try {
            // Tìm JSON trong response
            const jsonMatch = aiText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const aiData = JSON.parse(jsonMatch[0]);
                
                // Validate và merge với fallback
                return {
                    predictVanNhat: aiData.predictVanNhat || fallback.predictVanNhat,
                    confidence: aiData.confidence || fallback.confidence,
                    giai_thich: aiData.giai_thich || fallback.giai_thich,
                    phan_tich_chuyen_sau: aiData.phan_tich_chuyen_sau || fallback.phan_tich_chuyen_sau,
                    luu_y: aiData.luu_y || fallback.luu_y,
                    yeu_to_quyet_dinh: aiData.yeu_to_quyet_dinh || fallback.yeu_to_quyet_dinh,
                    ai_analysis: true
                };
            }
        } catch (error) {
            console.error('❌ Lỗi parse AI response:', error.message);
        }

        return fallback;
    }

    getFallbackResponse(initialPrediction, confidence, algorithmAnalysis) {
        return {
            predictVanNhat: initialPrediction,
            confidence: confidence > 0.7 ? "cao" : confidence > 0.6 ? "trung_bình" : "thấp",
            giai_thich: `Dự đoán dựa trên phân tích thuật toán: ${algorithmAnalysis.reasons.join(' ')}`,
            phan_tich_chuyen_sau: "Thuật toán phân tích đa yếu tố: xu hướng, chuỗi, thống kê và xác suất. Kết hợp trọng số khoa học để đưa ra dự đoán tối ưu.",
            luu_y: "Đây là dự đoán tự động, không đảm bảo 100% chính xác. Chơi có trách nhiệm.",
            yeu_to_quyet_dinh: algorithmAnalysis.reasons,
            fallback: true
        };
    }

    async generatePrediction() {
        try {
            console.log('🔄 Bắt đầu tạo dự đoán...');
            
            // Lấy dữ liệu lịch sử
            const historyData = await this.fetchHistoryData();
            if (!historyData || historyData.length < 3) {
                throw new Error("Không đủ dữ liệu lịch sử để phân tích");
            }

            // Phân tích thuật toán
            const technicalAnalysis = this.analyzePatterns(historyData);
            if (technicalAnalysis.error) {
                throw new Error(technicalAnalysis.error);
            }

            // Dự đoán từ thuật toán
            const algorithmPrediction = this.calculateInitialPrediction(technicalAnalysis);
            
            // Phân tích AI
            const aiAnalysis = await this.getAIAnalysis(
                historyData, 
                algorithmPrediction.prediction, 
                algorithmPrediction.confidence,
                algorithmPrediction
            );

            // Chuẩn bị kết quả cuối cùng
            const latestSession = Math.max(...historyData.map(item => item.session || 0));
            
            const finalResult = {
                id: "VanNhatZzz",
                session: latestSession,
                next_session: latestSession + 1,
                predictVanNhat: aiAnalysis.predictVanNhat,
                confidence: aiAnalysis.confidence,
                giai_thich: aiAnalysis.giai_thich,
                phan_tich_chuyen_sau: aiAnalysis.phan_tich_chuyen_sau,
                luu_y: aiAnalysis.luu_y,
                yeu_to_quyet_dinh: aiAnalysis.yeu_to_quyet_dinh,
                thong_tin_bo_sung: {
                    do_tin_cay_thuat_toan: `${(algorithmPrediction.confidence * 100).toFixed(1)}%`,
                    tong_so_du_lieu: technicalAnalysis.total_games,
                    ty_le_tai_history: `${(technicalAnalysis.tai_ratio * 100).toFixed(1)}%`,
                    ty_le_xiu_history: `${(technicalAnalysis.xiu_ratio * 100).toFixed(1)}%`,
                    xu_huong_gan_nhat: technicalAnalysis.recent_trend.details,
                    timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
                    version: "2.0.0",
                    ai_enhanced: !aiAnalysis.fallback
                }
            };

            // Cache kết quả
            predictionCache.data = finalResult;
            predictionCache.timestamp = Date.now();

            console.log('✅ Dự đoán hoàn thành:', finalResult.predictVanNhat);
            return finalResult;

        } catch (error) {
            console.error('❌ Lỗi tạo dự đoán:', error.message);
            
            // Fallback response
            return {
                id: "VanNhatZzz",
                session: 0,
                next_session: 1,
                predictVanNhat: "TÀI",
                confidence: "thấp",
                giai_thich: `Hệ thống tạm thời gặp sự cố: ${error.message}`,
                phan_tich_chuyen_sau: "Không thể phân tích do lỗi hệ thống. Vui lòng thử lại sau.",
                luu_y: "Dự đoán tạm thời không khả dụng.",
                thong_tin_bo_sung: {
                    error: error.message,
                    timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
                    emergency: true
                }
            };
        }
    }
}

// Khởi tạo predictor
const predictor = new AdvancedTaiXiuPredictor();

// Routes
app.get('/', (req, res) => {
    res.json({
        message: '🚀 VanNhatZzz AI Tài Xỉu Predictor API',
        version: '2.0.0',
        endpoints: {
            '/api/taixiu/predict': 'Dự đoán kết quả tiếp theo',
            '/api/taixiu/analysis': 'Phân tích kỹ thuật',
            '/api/taixiu/history': 'Lịch sử gần đây',
            '/api/health': 'Health check'
        },
        author: 'VanNhatZzz',
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
});

app.get('/api/taixiu/predict', async (req, res) => {
    try {
        // Kiểm tra cache
        if (predictionCache.data && 
            predictionCache.timestamp && 
            (Date.now() - predictionCache.timestamp) < CONFIG.CACHE_DURATION) {
            console.log('⚡ Trả về kết quả từ cache');
            return res.json({
                ...predictionCache.data,
                cached: true,
                cache_age: Math.round((Date.now() - predictionCache.timestamp) / 1000) + 's'
            });
        }

        const prediction = await predictor.generatePrediction();
        res.json(prediction);
    } catch (error) {
        res.status(500).json({
            error: error.message,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        });
    }
});

app.get('/api/taixiu/analysis', async (req, res) => {
    try {
        const historyData = await predictor.fetchHistoryData();
        const analysis = predictor.analyzePatterns(historyData);
        
        res.json({
            technical_analysis: analysis,
            recent_history: historyData.slice(-10),
            analysis_timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/taixiu/history', async (req, res) => {
    try {
        const historyData = await predictor.fetchHistoryData();
        res.json({
            data: historyData.slice(-20),
            total: historyData.length,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '2.0.0'
    });
});

// Cache warming cron job (tuỳ chọn)
cron.schedule('*/5 * * * *', async () => {
    console.log('🔥 Warming cache...');
    try {
        await predictor.generatePrediction();
        console.log('✅ Cache warmed successfully');
    } catch (error) {
        console.log('❌ Cache warming failed:', error.message);
    }
});

// Khởi chạy server
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy trên port ${PORT}`);
    console.log(`📊 VanNhatZzz AI Tài Xỉu Predictor v2.0.0`);
    console.log(`🔗 Truy cập: http://localhost:${PORT}`);
});

module.exports = app;
