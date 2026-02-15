import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { type UserPublic, type UserRegister, UsersService } from "@/client"
import { handleError } from "@/utils"
import useCustomToast from "./useCustomToast"

const isLoggedIn = () => {
  return true
}

const useAuth = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const { data: user } = useQuery<UserPublic | null>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      try {
        return await UsersService.readUserMe()
      } catch {
        return null
      }
    },
    retry: false,
  })

  const signUpMutation = useMutation({
    mutationFn: (data: UserRegister) =>
      UsersService.registerUser({ requestBody: data }),
    onSuccess: () => {
      navigate({ to: "/" })
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const loginMutation = useMutation({
    mutationFn: async (_data: unknown) => Promise.resolve(),
    onSuccess: () => {
      navigate({ to: "/" })
    },
    onError: handleError.bind(showErrorToast),
  })

  const logout = () => {
    queryClient.setQueryData(["currentUser"], null)
    navigate({ to: "/" })
  }

  return {
    user,
    signUpMutation,
    loginMutation,
    logout,
  }
}

export { isLoggedIn }
export default useAuth
