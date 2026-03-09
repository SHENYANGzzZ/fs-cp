/**
 * 按钮检测模块
 * 负责检测回到顶部按钮
 */

import { Page } from "puppeteer";

/**
 * 按钮检测器类
 */
export class ButtonDetector {
  private page: Page;
  private initialBackToTopButtonState: boolean = false;

  /**
   * 构造函数
   * @param page 页面对象
   */
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 初始化回到顶部按钮的初始状态
   */
  async initBackToTopButtonState(): Promise<void> {
    console.log("初始化回到顶部按钮状态...");
    this.initialBackToTopButtonState = await this.hasBackToTopButton();
    console.log(`回到顶部按钮初始状态: ${this.initialBackToTopButtonState}`);
  }

  /**
   * 检测回到顶部按钮从隐藏到显示的变化
   * @returns 是否检测到按钮从隐藏到显示的变化
   */
  async detectBackToTopButtonVisibilityChange(): Promise<boolean> {
    console.log("检测回到顶部按钮可见性变化...");
    const currentState = await this.hasBackToTopButton();
    console.log(`回到顶部按钮当前状态: ${currentState}, 初始状态: ${this.initialBackToTopButtonState}`);
    
    // 检查是否从隐藏变为显示
    return !this.initialBackToTopButtonState && currentState;
  }

  /**
   * 检测是否存在回到顶部按钮
   * @returns 是否存在回到顶部按钮
   */
  async hasBackToTopButton(): Promise<boolean> {
    return await this.page.evaluate(() => {
      // 飞书文档特有的回到顶部按钮选择器
      const feishuBackToTopSelectors = [
        // 基于用户提供的按钮结构
        'button:has(span.universe-icon)',
        'button:has(svg[data-icon="SpaceUpOutlined"])',
        'button:has(svg path[d*="M12.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L11 5.414V22a1 1 0 1 0 2 0V5.414l5.293 5.293a1 1 0 0 0 1.414-1.414l-7-7Z"])'
      ];
      
      // 检测飞书文档特有的回到顶部按钮
      for (const selector of feishuBackToTopSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (element) {
              // 检查元素是否可见
              const style = window.getComputedStyle(element);
              const isVisible = style.display !== 'none' && 
                              style.visibility !== 'hidden' && 
                              style.opacity !== '0' && 
                              (element as HTMLElement).offsetParent !== null;
              
              // 检查元素位置是否在右下角
              const rect = element.getBoundingClientRect();
              const isBottomRight = rect.right > window.innerWidth * 0.8 && 
                                  rect.bottom > window.innerHeight * 0.8;
              
              // 检查元素是否为按钮
              const isButton = element.tagName === 'BUTTON';
              
              // 检查按钮是否包含向上箭头图标
              let hasUpArrow = false;
              const svgElements = element.querySelectorAll('svg');
              for (let j = 0; j < svgElements.length; j++) {
                const svg = svgElements[j];
                // 检查svg是否包含向上箭头相关的属性或内容
                if (svg.getAttribute('data-icon') === 'SpaceUpOutlined' ||
                    svg.getAttribute('aria-label')?.includes('回到顶部') ||
                    svg.getAttribute('title')?.includes('回到顶部') ||
                    svg.querySelector('path[d*="M12.707 2.293"]') ||
                    svg.querySelector('path[d*="M12 2l-8 8h5v10h6V10h5l-8-8z"]') ||
                    svg.querySelector('path[d*="M18 15l-6-6-6 6"]')) {
                  hasUpArrow = true;
                  break;
                }
              }
              
              // 检查按钮是否有回到顶部相关的文本
              const buttonText = element.textContent?.toLowerCase() || '';
              const hasBackToTopText = buttonText.includes('回到顶部') || 
                                       buttonText.includes('back to top') || 
                                       buttonText.includes('top') || 
                                       buttonText.includes('up');
              
              // 只有当按钮可见、在右下角、是按钮且包含向上箭头或回到顶部文本时才认为是回到顶部按钮
              if (isButton && isVisible && isBottomRight && (hasUpArrow || hasBackToTopText)) {
                console.log(`检测到回到顶部按钮: ${selector}`);
                return true;
              }
            }
          }
        } catch (e) {
          // 忽略选择器语法错误
        }
      }
      
      // 检测所有按钮元素，特别关注右下角的圆形按钮
      const buttons = document.querySelectorAll('button');
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        if (button) {
          // 检查按钮是否可见
          const style = window.getComputedStyle(button);
          const isVisible = style.display !== 'none' && 
                          style.visibility !== 'hidden' && 
                          style.opacity !== '0' && 
                          (button as HTMLElement).offsetParent !== null;
          
          // 检查按钮位置是否在右下角
          const rect = button.getBoundingClientRect();
          const isBottomRight = rect.right > window.innerWidth * 0.8 && 
                              rect.bottom > window.innerHeight * 0.8;
          
          // 检查按钮是否为圆形
          const isRound = style.borderRadius === '50%' || 
                         style.borderRadius === '9999px' || 
                         button.classList.contains('circle') ||
                         button.classList.contains('round') ||
                         button.classList.contains('rounded');
          
          // 检查按钮是否包含向上箭头
          let hasUpArrow = false;
          const svgElements = button.querySelectorAll('svg');
          for (let j = 0; j < svgElements.length; j++) {
            const svg = svgElements[j];
            if (svg.getAttribute('data-icon') === 'SpaceUpOutlined' ||
                svg.getAttribute('aria-label')?.includes('回到顶部') ||
                svg.getAttribute('title')?.includes('回到顶部') ||
                svg.querySelector('path[d*="M12.707 2.293"]') ||
                svg.querySelector('path[d*="M12 2l-8 8h5v10h6V10h5l-8-8z"]') ||
                svg.querySelector('path[d*="M18 15l-6-6-6 6"]')) {
              hasUpArrow = true;
              break;
            }
          }
          
          // 检查按钮是否有回到顶部相关的文本
          const buttonText = button.textContent?.toLowerCase() || '';
          const hasBackToTopText = buttonText.includes('回到顶部') || 
                                   buttonText.includes('back to top') || 
                                   buttonText.includes('top') || 
                                   buttonText.includes('up');
          
          // 只有当按钮可见、在右下角、是圆形且包含向上箭头时才认为是回到顶部按钮
          if (isVisible && isBottomRight && isRound && hasUpArrow) {
            console.log(`检测到回到顶部按钮: 圆形=${isRound}, 有向上箭头=${hasUpArrow}, 有回到顶部文本=${hasBackToTopText}`);
            return true;
          }
        }
      }
      
      return false;
    });
  }
}
