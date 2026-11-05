import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

/**
 * 全局错误边界：安卓 WebView 里一旦 render 抛错就是整页白屏（没有控制台可看），
 * 用户只能清数据重装。这里兜住运行时异常，给出「重载」出口并说明数据不会丢
 *（全部数据在 localStorage，重载只是重建 React 树）。
 */
interface ErrorBoundaryState {
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FitCustom] 渲染异常：', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-ink">
        <div className="w-full max-w-sm rounded-card border border-line bg-surface p-5 shadow-sheet">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-h2 font-semibold text-ink">页面出错了</h1>
              <p className="text-cap text-ink-3">界面已停止渲染，数据仍保存在本机</p>
            </div>
          </div>

          <p className="mt-3 rounded-ctl bg-surface-subtle px-3 py-2 text-cap leading-relaxed text-ink-2">
            {this.state.error.message || '未知错误'}
          </p>

          <p className="mt-3 text-sm2 leading-relaxed text-ink-2">
            训练、体重与用药记录都存在本机 localStorage 中，重载不会丢失。
            如果反复出现，请先到「日志记录 → 数据备份」导出一份 JSON 再重载。
          </p>

          <div className="mt-4 space-y-2">
            <Button variant="primary" size="lg" block onClick={this.handleReload}>
              <RotateCcw className="h-4 w-4" />
              重新加载
            </Button>
            <Button variant="ghost" block onClick={this.handleReset}>
              仅重试当前界面
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
