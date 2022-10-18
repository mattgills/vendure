import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    ApplyCouponCodeResult,
    ActiveOrderResult,
    RemoveOrderItemsResult,
    UpdateOrderItemsResult,
    SetOrderShippingMethodResult,
} from '@vendure/common/lib/generated-shop-types';
import {
    MutationAddItemToDraftOrderArgs,
    MutationAdjustDraftOrderLineArgs,
    MutationApplyCouponCodeToDraftOrderArgs,
    MutationRemoveCouponCodeFromDraftOrderArgs,
    MutationRemoveDraftOrderLineArgs,
    MutationSetCustomerForDraftOrderArgs,
    MutationSetDraftOrderBillingAddressArgs,
    MutationSetDraftOrderShippingAddressArgs,
    MutationSetDraftOrderShippingMethodArgs,
    Permission,
    QueryEligibleShippingMethodsForDraftOrderArgs,
    SetCustomerForDraftOrderResult,
    ShippingMethodQuote,
} from '@vendure/common/lib/generated-types';

import { ErrorResultUnion, isGraphQlErrorResult, UserInputError } from '../../../common/index';
import { TransactionalConnection } from '../../../connection/index';
import { Customer, Order } from '../../../entity/index';
import { CustomerService, OrderService } from '../../../service/index';
import { RequestContext } from '../../common/request-context';
import { Allow } from '../../decorators/allow.decorator';
import { Ctx } from '../../decorators/request-context.decorator';
import { Transaction } from '../../decorators/transaction.decorator';

@Resolver()
export class DraftOrderResolver {
    constructor(
        private orderService: OrderService,
        private customerService: CustomerService,
        private connection: TransactionalConnection,
    ) {}

    @Transaction()
    @Mutation()
    @Allow(Permission.CreateOrder)
    async createDraftOrder(@Ctx() ctx: RequestContext): Promise<Order> {
        return this.orderService.createDraft(ctx);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.CreateOrder)
    async addItemToDraftOrder(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationAddItemToDraftOrderArgs,
    ): Promise<ErrorResultUnion<UpdateOrderItemsResult, Order>> {
        return this.orderService.addItemToOrder(
            ctx,
            args.orderId,
            args.productVariantId,
            args.quantity,
            (args as any).customFields,
        );
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.Owner)
    async adjustDraftOrderLine(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationAdjustDraftOrderLineArgs,
    ): Promise<ErrorResultUnion<UpdateOrderItemsResult, Order>> {
        if (args.quantity === 0) {
            return this.removeDraftOrderLine(ctx, { orderId: args.orderId, orderLineId: args.orderLineId });
        }
        return this.orderService.adjustOrderLine(
            ctx,
            args.orderId,
            args.orderLineId,
            args.quantity,
            (args as any).customFields,
        );
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.CreateOrder)
    async removeDraftOrderLine(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationRemoveDraftOrderLineArgs,
    ): Promise<ErrorResultUnion<RemoveOrderItemsResult, Order>> {
        return this.orderService.removeItemFromOrder(ctx, args.orderId, args.orderLineId);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.CreateOrder)
    async setCustomerForDraftOrder(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationSetCustomerForDraftOrderArgs,
    ): Promise<ErrorResultUnion<SetCustomerForDraftOrderResult, Order>> {
        let customer: Customer;
        if (args.customerId) {
            const result = await this.customerService.findOne(ctx, args.customerId);
            if (!result) {
                throw new UserInputError(
                    `No customer with the id "${args.customerId}" was found in this Channel`,
                );
            }
            customer = result;
        } else if (args.input) {
            const result = await this.customerService.createOrUpdate(ctx, args.input, true);
            if (isGraphQlErrorResult(result)) {
                return result;
            }
            customer = result;
        } else {
            throw new UserInputError(
                `Either "customerId" or "input" must be supplied to setCustomerForDraftOrder`,
            );
        }

        return this.orderService.addCustomerToOrder(ctx, args.orderId, customer);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.CreateOrder)
    async setDraftOrderShippingAddress(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationSetDraftOrderShippingAddressArgs,
    ): Promise<Order> {
        return this.orderService.setShippingAddress(ctx, args.orderId, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.CreateOrder)
    async setDraftOrderBillingAddress(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationSetDraftOrderBillingAddressArgs,
    ): Promise<ErrorResultUnion<ActiveOrderResult, Order>> {
        return this.orderService.setBillingAddress(ctx, args.orderId, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.CreateOrder)
    async applyCouponCodeToDraftOrder(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationApplyCouponCodeToDraftOrderArgs,
    ): Promise<ErrorResultUnion<ApplyCouponCodeResult, Order>> {
        return this.orderService.applyCouponCode(ctx, args.orderId, args.couponCode);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.CreateOrder)
    async removeCouponCodeFromDraftOrder(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationRemoveCouponCodeFromDraftOrderArgs,
    ): Promise<Order> {
        return this.orderService.removeCouponCode(ctx, args.orderId, args.couponCode);
    }

    @Query()
    @Allow(Permission.CreateOrder)
    async eligibleShippingMethodsForDraftOrder(
        @Ctx() ctx: RequestContext,
        @Args() args: QueryEligibleShippingMethodsForDraftOrderArgs,
    ): Promise<ShippingMethodQuote[]> {
        return this.orderService.getEligibleShippingMethods(ctx, args.orderId);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.CreateOrder)
    async setDraftOrderShippingMethod(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationSetDraftOrderShippingMethodArgs,
    ): Promise<ErrorResultUnion<SetOrderShippingMethodResult, Order>> {
        return this.orderService.setShippingMethod(ctx, args.orderId, args.shippingMethodId);
    }
}