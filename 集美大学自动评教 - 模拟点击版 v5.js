// ==UserScript==
// @name         集美大学自动评教 - 模拟点击版 v5
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  模拟真人点击：1-6、8-10题选10分，第7题选5分，第11题选"否"，第12题留空
// @author       meng2zd
// @license      MIT
// @match        *://*/*evaluation*
// @match        *://*/*pingjiao*
// @match        *://*/*评教*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // 只在元素被遮挡时，最小滚动到可见区域（不会跳回顶部）
    function ensureVisible(el) {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const inViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
        if (!inViewport) {
            el.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        }
    }

    // 原生点击
    function realClick(el) {
        if (!el) return;
        ensureVisible(el);
        el.focus && el.focus();
        el.click();
    }

    // 触发事件辅助 Vue 绑定
    function triggerEvent(el, type) {
        if (!el) return;
        el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    }

    // 轮询等待下拉框出现（最多等 2 秒，通常 200ms 内就出来）
    async function waitForDropdown(select, timeout = 2000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            let dd = select.querySelector('.el-select-dropdown:not([style*="display: none"])');
            if (!dd) {
                const visible = document.querySelectorAll('.el-select-dropdown:not([style*="display: none"])');
                if (visible.length === 1) dd = visible[0];
            }
            if (dd) return dd;
            await sleep(50);
        }
        return null;
    }

    // 轮询等待下拉框关闭
    async function waitForDropdownClose(timeout = 2000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const visible = document.querySelectorAll('.el-select-dropdown:not([style*="display: none"])');
            if (visible.length === 0) return true;
            await sleep(50);
        }
        return false;
    }

    // 填写下拉框
    async function fillSelect(item, value) {
        const select = item.querySelector('.el-select');
        if (!select) return false;
        const input = select.querySelector('.el-input__inner');
        if (!input) return false;

        // 1. 点击 input 打开下拉
        realClick(input);

        // 2. 智能等待下拉展开（不用固定 sleep）
        const dropdown = await waitForDropdown(select);
        if (!dropdown) {
            console.warn(`[自动评教] 下拉框未打开`);
            return false;
        }

        // 3. 查找并点击对应选项
        const options = dropdown.querySelectorAll('.el-select-dropdown__item');
        let target = null;
        for (let opt of options) {
            if (opt.textContent.trim() === String(value)) {
                target = opt;
                break;
            }
        }
        if (!target) {
            console.warn(`[自动评教] 未找到选项 ${value}`);
            return false;
        }

        realClick(target);

        // 4. 智能等待关闭
        await waitForDropdownClose();

        // 5. 触发 change + blur 确保 Vue 绑定
        triggerEvent(input, 'change');
        triggerEvent(input, 'blur');
        await sleep(200); // 短缓冲

        return true;
    }

    // 填写单选（第11题选"否"）
    async function fillRadio(item) {
        const radios = item.querySelectorAll('.el-radio');
        for (let radio of radios) {
            const label = radio.querySelector('.el-radio__label');
            if (label && label.textContent.trim() === '否') {
                realClick(radio);
                await sleep(300);
                return true;
            }
        }
        return false;
    }

    async function autoFill() {
        const items = document.querySelectorAll('.item');
        if (!items.length) {
            alert('未找到评教题目');
            return;
        }

        let done = 0;
        let errors = [];

        for (let item of items) {
            const idxEl = item.querySelector('.index');
            if (!idxEl) continue;

            const num = parseInt(idxEl.textContent.trim().replace(/\D/g, ''));
            if (isNaN(num)) continue;

            if (num >= 1 && num <= 10) {
                const score = (num === 7) ? 5 : 10;
                const ok = await fillSelect(item, score);
                if (ok) done++;
                else errors.push(`第${num}题`);
            } else if (num === 11) {
                const ok = await fillRadio(item);
                if (ok) done++;
                else errors.push('第11题');
            }
        }

        // 最后给 Vue 一个 tick 时间
        await sleep(800);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (errors.length) {
            alert(`自动评教部分完成：成功 ${done} 项。\n未成功：${errors.join('、')}`);
        } else {
            alert(`自动评教完成：共 ${done} 项。\n\n请核对分值后点击【匿名提交】。\n（若提示 id is null，是系统自身问题，建议刷新页面或换浏览器重试）`);
        }
    }

    if (document.readyState === 'complete') {
        setTimeout(autoFill, 2000);
    } else {
        window.addEventListener('load', () => setTimeout(autoFill, 2000));
    }

    const btn = document.createElement('button');
    btn.innerHTML = '▶ 自动评教';
    btn.style.cssText = `
        position: fixed;
        top: 120px;
        right: 30px;
        z-index: 99999;
        padding: 12px 22px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        transition: transform 0.2s;
    `;
    btn.onmouseenter = () => btn.style.transform = 'scale(1.05)';
    btn.onmouseleave = () => btn.style.transform = 'scale(1)';
    btn.onclick = autoFill;
    document.body.appendChild(btn);
})();