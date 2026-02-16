import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
// 导入提取后的传统 CSS 样式
import "./button.css"

/**
 * 按钮变体配置
 * 使用 class-variance-authority 定义按钮的不同样式组合
 */
const buttonVariants = cva(
  "ui-button", // 基础样式类名
  {
    variants: {
      /**
       * 视觉风格变体
       */
      variant: {
        default: "ui-button--default",
        destructive: "ui-button--destructive",
        outline: "ui-button--outline",
        secondary: "ui-button--secondary",
        ghost: "ui-button--ghost",
        link: "ui-button--link",
      },
      /**
       * 尺寸变体
       */
      size: {
        default: "ui-button--size-default",
        sm: "ui-button--size-sm",
        lg: "ui-button--size-lg",
        icon: "ui-button--size-icon",
        "icon-sm": "ui-button--size-icon-sm",
        "icon-lg": "ui-button--size-icon-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Button 组件属性定义
 */
interface ButtonProps
  extends React.ComponentProps<"button">,
  VariantProps<typeof buttonVariants> {
  /**
   * 是否作为子组件的容器（用于 Radix UI Slot）
   */
  asChild?: boolean
}

/**
 * 通用按钮组件
 * 
 * @param className 额外的 CSS 类名
 * @param variant 风格变体 (default, destructive, outline 等)
 * @param size 尺寸变体 (default, sm, lg, icon 等)
 * @param asChild 是否渲染为 Slot 容器
 * @param props 其他 HTML 按钮属性
 */
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  // 根据 asChild 决定渲染 Radix Slot 还是原生 button
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      // 合并基础样式、变体样式和外部传入的类名
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
