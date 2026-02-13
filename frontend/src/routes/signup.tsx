import { createFileRoute, redirect } from "@tanstack/react-router"
import { useForm } from "react-hook-form"

import { type UserRegister } from "@/client"
import useAuth from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthLayout } from "@/components/Common/AuthLayout"
import { FormStack, FormField } from "@/components/semantic/layout"

export const Route = createFileRoute("/signup")({
  component: Signup,
  beforeLoad: async ({ context }: any) => {
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: "/" })
    }
  },
})

function Signup() {
  const { signUpMutation } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserRegister>({
    mode: "onBlur",
    defaultValues: {
      email: "",
      password: "",
      full_name: "",
    },
  })

  const onSubmit = async (data: UserRegister) => {
    signUpMutation.mutate(data)
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign Up</CardTitle>
          <CardDescription>
            Enter your information to create an account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FormStack>
              <FormField>
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  {...register("full_name")}
                  placeholder="Full Name"
                />
              </FormField>
              <FormField>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  {...register("email", {
                    required: "Email is required",
                  })}
                />
                {errors.email && (
                  <p className="text-destructive text-xs">
                    {errors.email.message}
                  </p>
                )}
              </FormField>
              <FormField>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...register("password", {
                    required: "Password is required",
                  })}
                />
                {errors.password && (
                  <p className="text-destructive text-xs">
                    {errors.password.message}
                  </p>
                )}
              </FormField>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                Create an account
              </Button>
              <Button variant="outline" className="w-full" disabled={isSubmitting}>
                Sign up with GitHub
              </Button>
            </FormStack>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <a href="/login" className="underline underline-offset-4">
                Login
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
