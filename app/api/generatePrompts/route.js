// app/api/generatePrompts/route.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      你是一個惡搞、幽默、有點地獄梗的派對遊戲題目製作人。
      請生成 3 題全新的繁體中文情境填空題，格式為 JSON 陣列。
      每題題目中需要包含「___」供玩家填空。
      題目要適合朋友之間互相惡搞，內容要新穎、有趣，不要太死板。
      不要包含政治敏感內容，但可以帶有適度的嘲諷或黑色幽默。
      例如：
      [
        "如果能在校長的車上貼一張貼紙，我要貼「___」",
        "在便利商店打工時，最想對奧客說的話是「___」",
        "發現男朋友的手機裡竟然有和「___」的合照"
      ]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // 清理 Gemini 有時會輸出的 markdown 格式
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const prompts = JSON.parse(text);

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("Gemini API 錯誤:", error);
    // 如果 API 失敗，返回一個備用題庫防止遊戲卡住
    return NextResponse.json({ 
      prompts: [
        "我覺得我們學校的校規應該增加一條「___」",
        "如果我的體重計會說話，它一定會說「___」",
        "今天在路上看到「___」在跳排舞"
      ],
      error: "AI 生成失敗，使用備用題庫"
    });
  }
}
