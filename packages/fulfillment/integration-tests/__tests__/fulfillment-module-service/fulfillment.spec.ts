import { resolve } from "path"
import { Modules, ModulesDefinition } from "@medusajs/modules-sdk"
import { IFulfillmentModuleService } from "@medusajs/types"
import { moduleIntegrationTestRunner, SuiteOptions } from "medusa-test-utils"
import {
  generateCreateFulfillmentData,
  generateCreateShippingOptionsData,
} from "../../__fixtures__"
import { initModules } from "medusa-test-utils/dist"
import { FulfillmentProviderService } from "@services"
import { FulfillmentProviderServiceFixtures } from "../../__fixtures__/providers"

jest.setTimeout(100000)

const moduleOptions = {
  providers: [
    {
      resolve: resolve(
        process.cwd() +
          "/integration-tests/__fixtures__/providers/default-provider"
      ),
      options: {
        config: {
          "test-provider": {},
        },
      },
    },
  ],
}

const providerId = "fixtures-fulfillment-provider_test-provider"

moduleIntegrationTestRunner({
  moduleName: Modules.FULFILLMENT,
  moduleOptions: moduleOptions,
  testSuite: ({
    MikroOrmWrapper,
    service,
  }: SuiteOptions<IFulfillmentModuleService>) => {
    describe("Fulfillment Module Service", () => {
      it("should load and save all the providers on bootstrap", async () => {
        const databaseConfig = {
          schema: "public",
          clientUrl: MikroOrmWrapper.clientUrl,
        }

        const providersConfig = {}
        for (let i = 0; i < 10; i++) {
          providersConfig[`provider-${i}`] = {}
        }

        const moduleOptions = {
          databaseConfig,
          modulesConfig: {
            [Modules.FULFILLMENT]: {
              definition: ModulesDefinition[Modules.FULFILLMENT],
              options: {
                databaseConfig,
                providers: [
                  {
                    resolve: resolve(
                      process.cwd() +
                        "/integration-tests/__fixtures__/providers/default-provider"
                    ),
                    options: {
                      config: providersConfig,
                    },
                  },
                ],
              },
            },
          },
        }

        const { shutdown } = await initModules(moduleOptions)

        const fulfillmentProviderrs =
          await MikroOrmWrapper.forkManager().execute(
            `SELECT * FROM fulfillment_provider`
          )

        expect(fulfillmentProviderrs).toHaveLength(
          Object.keys(providersConfig).length + 1 // +1 for the default provider
        )

        for (const [name] of Object.entries(providersConfig)) {
          const provider = fulfillmentProviderrs.find((p) => {
            return (
              p.id ===
              FulfillmentProviderService.getRegistrationIdentifier(
                FulfillmentProviderServiceFixtures,
                name
              )
            )
          })
          expect(provider).toBeDefined()
        }

        await shutdown()
      })
    })

    describe("Fulfillment Module Service", () => {
      describe("read", () => {
        it("should list fulfillment", async () => {
          const shippingProfile = await service.createShippingProfiles({
            name: "test",
            type: "default",
          })
          const fulfillmentSet = await service.create({
            name: "test",
            type: "test-type",
          })
          const serviceZone = await service.createServiceZones({
            name: "test",
            fulfillment_set_id: fulfillmentSet.id,
          })

          const shippingOption = await service.createShippingOptions(
            generateCreateShippingOptionsData({
              fulfillment_provider_id: providerId,
              service_zone_id: serviceZone.id,
              shipping_profile_id: shippingProfile.id,
            })
          )

          const fulfillment = await service.createFulfillment(
            generateCreateFulfillmentData({
              provider_id: providerId,
              shipping_option_id: shippingOption.id,
            })
          )

          const result = await service.listFulfillments({
            shipping_option_id: shippingOption.id,
          })

          expect(result.length).toEqual(1)
          expect(result[0].id).toEqual(fulfillment.id)
        })

        it("should retrieve the fulfillment options", async () => {
          const fulfillmentOptions = await service.retrieveFulfillmentOptions(
            providerId
          )

          expect(fulfillmentOptions).toEqual({})
        })
      })

      describe("mutations", () => {
        describe("on create", () => {
          it("should create a fulfillment", async () => {
            const shippingProfile = await service.createShippingProfiles({
              name: "test",
              type: "default",
            })
            const fulfillmentSet = await service.create({
              name: "test",
              type: "test-type",
            })
            const serviceZone = await service.createServiceZones({
              name: "test",
              fulfillment_set_id: fulfillmentSet.id,
            })

            const shippingOption = await service.createShippingOptions(
              generateCreateShippingOptionsData({
                fulfillment_provider_id: providerId,
                service_zone_id: serviceZone.id,
                shipping_profile_id: shippingProfile.id,
              })
            )

            const fulfillment = await service.createFulfillment(
              generateCreateFulfillmentData({
                provider_id: providerId,
                shipping_option_id: shippingOption.id,
              })
            )

            expect(fulfillment).toEqual(
              expect.objectContaining({
                id: expect.any(String),
                packed_at: null,
                shipped_at: null,
                delivered_at: null,
                canceled_at: null,
                data: null,
                provider_id: providerId,
                shipping_option_id: shippingOption.id,
                metadata: null,
                delivery_address: expect.objectContaining({
                  id: expect.any(String),
                }),
                items: [
                  expect.objectContaining({
                    id: expect.any(String),
                  }),
                ],
                labels: [
                  expect.objectContaining({
                    id: expect.any(String),
                  }),
                ],
              })
            )
          })
        })

        describe("on cancel", () => {
          let fulfillment

          beforeEach(async () => {
            const shippingProfile = await service.createShippingProfiles({
              name: "test",
              type: "default",
            })
            const fulfillmentSet = await service.create({
              name: "test",
              type: "test-type",
            })
            const serviceZone = await service.createServiceZones({
              name: "test",
              fulfillment_set_id: fulfillmentSet.id,
            })

            const shippingOption = await service.createShippingOptions(
              generateCreateShippingOptionsData({
                fulfillment_provider_id: providerId,
                service_zone_id: serviceZone.id,
                shipping_profile_id: shippingProfile.id,
              })
            )

            fulfillment = await service.createFulfillment(
              generateCreateFulfillmentData({
                provider_id: providerId,
                shipping_option_id: shippingOption.id,
              })
            )
          })

          it("should cancel a fulfillment successfully", async () => {
            const result = await service.cancelFulfillment(fulfillment.id)
            // should be idempotent
            const idempotentResult = await service.cancelFulfillment(
              fulfillment.id
            )

            expect(result.canceled_at).not.toBeNull()
            expect(idempotentResult.canceled_at).not.toBeNull()
            expect(idempotentResult.canceled_at).toEqual(result.canceled_at)
          })

          it("should fail to cancel a fulfillment that is already shipped", async () => {
            await service.updateFulfillment(fulfillment.id, {
              shipped_at: new Date(),
            })

            const err = await service
              .cancelFulfillment(fulfillment.id)
              .catch((e) => e)

            expect(err.message).toEqual(
              `Fulfillment with id ${fulfillment.id} already shipped`
            )
          })

          it("should fail to cancel a fulfillment that is already delivered", async () => {
            await service.updateFulfillment(fulfillment.id, {
              delivered_at: new Date(),
            })

            const err = await service
              .cancelFulfillment(fulfillment.id)
              .catch((e) => e)

            expect(err.message).toEqual(
              `Fulfillment with id ${fulfillment.id} already delivered`
            )
          })
        })
      })
    })
  },
})
