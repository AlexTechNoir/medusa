import { CreateLineItemForCartDTO, ICartModuleService } from "@medusajs/types"
import { StepResponse, createStep } from "@medusajs/workflows-sdk"
import { ModuleRegistrationName } from "../../../../../modules-sdk/dist"

interface StepInput {
  items: CreateLineItemForCartDTO[]
}

export const addToCartStepId = "add-to-cart-step"
export const addToCartStep = createStep(
  addToCartStepId,
  async (data: StepInput, { container }) => {
    const cartService = container.resolve<ICartModuleService>(
      ModuleRegistrationName.CART
    )

    const items = await cartService.addLineItems(data.items)

    return new StepResponse(items)
  },
  async (createdLineItems, { container }) => {
    const cartService: ICartModuleService = container.resolve(
      ModuleRegistrationName.CART
    )
    if (!createdLineItems?.length) {
      return
    }

    await cartService.deleteLineItems(createdLineItems.map((c) => c.id))
  }
)
